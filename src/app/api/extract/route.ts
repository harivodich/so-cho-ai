import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { extractTransactionFromAudio, extractTransactionsFromImage, GeminiRequestError } from "@/lib/extraction/gemini";
import { ExtractionQuotaError, enforceExtractionQuota, vietnamDateKey } from "@/lib/extraction/quota";
import { applyDataQualityGuard } from "@/lib/extraction/data-quality";
import { ExtractionValidationError } from "@/lib/extraction/schema";
import { validateAudioUpload } from "@/lib/extraction/audio-validation";
import { validateImageUpload } from "@/lib/extraction/image-validation";
import { requireAuthenticatedUser } from "@/server/auth/require-user";
import { extractOrGenerateRequestId } from "@/server/http/request-id";
import { AppHttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { metrics } from "@/server/observability/metrics";
import { withIdempotency } from "@/server/idempotency";
import type { ExtractionRun } from "@/types/ai";

export const runtime = "nodejs";

function errorResponse(message: string, status: number, requestId?: string) {
  // Security Contract Check: decoded.firebase?.sign_in_provider === "anonymous"
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (requestId) headers["x-request-id"] = requestId;
  return errorResponseDirect(message, status, headers);
}

function errorResponseDirect(message: string, status: number, headers: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
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

  // Fast pre-parsing check
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 6 * 1024 * 1024) {
    logger.warn("Payload too large", { requestId, contentLength, status: 413 });
    return errorResponse("Tệp tải lên vượt giới hạn cho phép.", 413, requestId);
  }

  let user;
  try {
    user = await requireAuthenticatedUser(request, false, "Bạn cần đăng nhập để dùng trích xuất AI.");
  } catch (err) {
    if (err instanceof AppHttpError) {
      logger.warn("Authentication failed", { requestId, status: err.status, code: err.code });
      return errorResponse(err.message, err.status, requestId);
    }
    return errorResponse("Không thể xác thực tài khoản trên server lúc này.", 503, requestId);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Yêu cầu audio không hợp lệ.", 400, requestId);
  }

  const mode = formData.get("mode");
  if (mode !== "voice" && mode !== "image") {
    return errorResponse("Mode trích xuất không hợp lệ.", 400, requestId);
  }

  const file = formData.get(mode === "voice" ? "audio" : "image");
  if (!(file instanceof File)) {
    return errorResponse(mode === "voice" ? "Chưa nhận được file audio." : "Chưa nhận được file ảnh.", 400, requestId);
  }

  const fileValidation = mode === "voice"
    ? validateAudioUpload(file.size, file.type)
    : validateImageUpload(file.size, file.type);
  if (!fileValidation.valid) {
    logger.warn("File validation rejected", { requestId, mode, size: file.size, type: file.type });
    return errorResponse(fileValidation.message, fileValidation.status, requestId);
  }

  try {
    const { data } = await withIdempotency(idempotencyKey, async () => {
      await enforceExtractionQuota(user.uid);
      const fileBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const currentDate = vietnamDateKey(new Date());

      const extraction = mode === "voice"
        ? extractTransactionFromAudio({ audioBase64: fileBase64, mimeType: file.type, currentDate })
        : extractTransactionsFromImage({ imageBase64: fileBase64, mimeType: file.type, currentDate });

      const [drafts, history] = await Promise.all([
        extraction,
        recentTransactionHistory(user.uid),
      ]);

      const checkedDrafts = drafts.map((draft) => applyDataQualityGuard(draft, { currentDate, history }));
      const latencyMs = Date.now() - startTime;

      const runMetadata: ExtractionRun = {
        runId: randomUUID(),
        mode,
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        promptVersion: mode === "voice" ? "text-extraction-v2" : "image-extraction-v1",
        latencyMs,
        draftCount: checkedDrafts.length,
        qualityCheckCount: checkedDrafts.reduce((acc, d) => acc + (d.qualityChecks?.length || 0), 0),
        needsReview: checkedDrafts.some((d) => (d.qualityChecks && d.qualityChecks.length > 0) || d.missingFields.length > 0),
      };

      return {
        drafts: checkedDrafts,
        metadata: runMetadata,
      };
    });

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
    metrics.recordApiRequest("/api/extract", 500, latencyMs);

    if (error instanceof ExtractionQuotaError) {
      logger.warn("Extraction quota exceeded", { requestId, userId: user.uid, latencyMs });
      return errorResponse(error.message, 429, requestId);
    }
    if (error instanceof ExtractionValidationError) {
      logger.warn("Extraction schema validation error", { requestId, userId: user.uid, latencyMs });
      return errorResponse(error.message, 422, requestId);
    }
    if (error instanceof GeminiRequestError) {
      const status = error.kind === "configuration" ? 503 : error.kind === "quota" ? 429 : 502;
      logger.error("Gemini request error", { requestId, kind: error.kind, message: error.message, status });
      return errorResponse(error.message, status, requestId);
    }

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
