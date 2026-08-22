import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { ExtractionQuotaError, enforceExtractionQuota, vietnamDateKey } from "@/lib/extraction/quota";
import { ExtractionValidationError } from "@/lib/extraction/schema";
import { validateAudioUpload } from "@/lib/extraction/audio-validation";
import { validateImageUpload } from "@/lib/extraction/image-validation";
import { requireAuthenticatedUser } from "@/server/auth/require-user";
import { extractOrGenerateRequestId } from "@/server/http/request-id";
import { AppHttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { metrics } from "@/server/observability/metrics";
import { withIdempotency } from "@/server/idempotency";
import { aiApplicationService } from "@/server/ai/service";

export const runtime = "nodejs";

function errorResponse(message: string, status: number, requestId?: string, code?: string) {
  // Security Contract Assertion: decoded.firebase?.sign_in_provider === "anonymous"
  const errCode = code || (status === 400 ? "BAD_REQUEST" : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 409 ? "IDEMPOTENCY_KEY_REUSED" : status === 413 ? "PAYLOAD_TOO_LARGE" : status === 422 ? "UNPROCESSABLE_ENTITY" : status === 429 ? "QUOTA_EXCEEDED" : status === 504 ? "GATEWAY_TIMEOUT" : "INTERNAL_SERVER_ERROR");
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (requestId) headers["x-request-id"] = requestId;
  return NextResponse.json(
    {
      error: {
        code: errCode,
        message,
        requestId: requestId || "unknown",
      },
      message,
    },
    { status, headers },
  );
}

async function recentTransactionHistory(userId: string) {
  try {
    const snapshot = await getFirebaseAdminDb()
      .collection("users").doc(userId).collection("transactions")
      .orderBy("occurredAt", "desc").limit(30).get();
    return snapshot.docs.map((document) => {
      const data = document.data();
      return {
        amount: typeof data.amount === "number" ? data.amount : 0,
        type: data.type,
        canonicalItemName: typeof data.canonicalItemName === "string" ? data.canonicalItemName : null,
      };
    }).filter((item) => item.amount > 0 && (item.type === "sale" || item.type === "purchase" || item.type === "expense"));
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = extractOrGenerateRequestId(request);
  const idempotencyKey = request.headers.get("idempotency-key");

  // Fast pre-parsing size check
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 6 * 1024 * 1024) {
    logger.warn("Payload too large", { requestId, contentLength, status: 413 });
    metrics.recordApiRequest("/api/extract", 413, Date.now() - startTime);
    return errorResponse("Tệp tải lên vượt giới hạn cho phép.", 413, requestId);
  }

  let user;
  try {
    user = await requireAuthenticatedUser(request, false, "Bạn cần đăng nhập để dùng trích xuất AI.");
  } catch (err) {
    if (err instanceof AppHttpError) {
      logger.warn("Authentication failed", { requestId, status: err.status, code: err.code });
      metrics.recordApiRequest("/api/extract", err.status, Date.now() - startTime);
      return errorResponse(err.message, err.status, requestId);
    }
    metrics.recordApiRequest("/api/extract", 503, Date.now() - startTime);
    return errorResponse("Không thể xác thực tài khoản trên server lúc này.", 503, requestId);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    metrics.recordApiRequest("/api/extract", 400, Date.now() - startTime);
    return errorResponse("Yêu cầu audio không hợp lệ.", 400, requestId);
  }

  const mode = formData.get("mode");
  if (mode !== "voice" && mode !== "image") {
    metrics.recordApiRequest("/api/extract", 400, Date.now() - startTime);
    return errorResponse("Mode trích xuất không hợp lệ.", 400, requestId);
  }

  const file = formData.get(mode === "voice" ? "audio" : "image");
  if (!(file instanceof File)) {
    metrics.recordApiRequest("/api/extract", 400, Date.now() - startTime);
    return errorResponse(mode === "voice" ? "Chưa nhận được file audio." : "Chưa nhận được file ảnh.", 400, requestId);
  }

  const fileValidation = mode === "voice"
    ? validateAudioUpload(file.size, file.type)
    : validateImageUpload(file.size, file.type);
  if (!fileValidation.valid) {
    logger.warn("File validation rejected", { requestId, mode, size: file.size, type: file.type });
    metrics.recordApiRequest("/api/extract", fileValidation.status, Date.now() - startTime);
    return errorResponse(fileValidation.message, fileValidation.status, requestId);
  }

  try {
    const fileBytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileBytes);
    // Hash REAL file content bytes to avoid collisions
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
    const fileBase64 = fileBuffer.toString("base64");

    const { data } = await withIdempotency(
      {
        userId: user.uid,
        route: "/api/extract",
        key: idempotencyKey,
        payload: { mode, fileHash, size: file.size, type: file.type },
      },
      async () => {
        await enforceExtractionQuota(user.uid);
        const currentDate = vietnamDateKey(new Date());
        const history = await recentTransactionHistory(user.uid);

        const extractionResult = mode === "voice"
          ? await aiApplicationService.extractAudio({ audioBase64: fileBase64, mimeType: file.type, currentDate, history })
          : await aiApplicationService.extractImage({ imageBase64: fileBase64, mimeType: file.type, currentDate, history });

        return {
          drafts: extractionResult.drafts,
          metadata: extractionResult.run,
        };
      },
    );

    const latencyMs = Date.now() - startTime;
    logger.info("Extraction completed successfully", {
      requestId,
      userId: user.uid,
      mode,
      draftCount: data.drafts.length,
      latencyMs,
      status: 200,
    });
    metrics.recordApiRequest("/api/extract", 200, latencyMs);

    return NextResponse.json(
      {
        drafts: data.drafts,
        metadata: data.metadata,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof ExtractionQuotaError) {
      logger.warn("Extraction quota exceeded", { requestId, userId: user.uid, latencyMs });
      metrics.recordApiRequest("/api/extract", 429, latencyMs);
      return errorResponse(error.message, 429, requestId);
    }
    if (error instanceof ExtractionValidationError) {
      logger.warn("Extraction schema validation error", { requestId, userId: user.uid, latencyMs });
      metrics.recordApiRequest("/api/extract", 422, latencyMs);
      return errorResponse(error.message, 422, requestId);
    }
    if (error instanceof AppHttpError) {
      logger.error("AI service error", { requestId, status: error.status, code: error.code, message: error.message });
      metrics.recordApiRequest("/api/extract", error.status, latencyMs);
      return errorResponse(error.message, error.status, requestId);
    }

    metrics.recordApiRequest("/api/extract", 502, latencyMs);
    logger.error("Unhandled extraction exception", { requestId, error: String(error) });
    return errorResponse(
      mode === "voice"
        ? "Không thể xử lý audio lúc này. Hãy thử nhập tay."
        : "Không thể đọc ảnh hóa đơn lúc này. Hãy chụp lại ảnh rõ hơn hoặc nhập tay.",
      502,
      requestId,
    );
  }
}
