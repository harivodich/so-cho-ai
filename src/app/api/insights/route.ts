import { NextResponse } from "next/server";

import { generateDailyInsight, DailyInsightError } from "@/lib/insights/gemini";
import { enforceDailyInsightQuota, DailyInsightQuotaError } from "@/lib/insights/quota";
import { dailyInsightSnapshotSchema } from "@/lib/insights/schema";
import { requireAuthenticatedUser } from "@/server/auth/require-user";
import { extractOrGenerateRequestId } from "@/server/http/request-id";
import { AppHttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { metrics } from "@/server/observability/metrics";
import { withIdempotency } from "@/server/idempotency";

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

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = extractOrGenerateRequestId(request);
  const idempotencyKey = request.headers.get("idempotency-key");

  if (Number(request.headers.get("content-length") ?? 0) > 4 * 1024) {
    return errorResponse("Dữ liệu báo cáo vượt giới hạn cho phép.", 413, requestId);
  }

  let user;
  try {
    user = await requireAuthenticatedUser(request, false, "Bạn cần đăng nhập để dùng nhận xét AI.");
  } catch (err) {
    if (err instanceof AppHttpError) {
      return errorResponse(err.message, err.status, requestId);
    }
    return errorResponse("Server chưa thể xác thực Firebase. Hãy kiểm tra quyền Google Cloud của môi trường chạy ứng dụng.", 503, requestId);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 4 * 1024) {
      return errorResponse("Dữ liệu báo cáo vượt giới hạn cho phép.", 413, requestId);
    }
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Dữ liệu báo cáo không hợp lệ.", 400, requestId);
  }

  const snapshot = dailyInsightSnapshotSchema.safeParse(body);
  if (!snapshot.success) {
    logger.warn("Insight snapshot schema validation failed", { requestId, userId: user.uid });
    return errorResponse("Số liệu tổng hợp không đúng cấu trúc.", 422, requestId);
  }

  try {
    const { data } = await withIdempotency(idempotencyKey, async () => {
      await enforceDailyInsightQuota(user.uid);
      const insight = await generateDailyInsight(snapshot.data);
      return insight;
    });

    const latencyMs = Date.now() - startTime;
    logger.info("Daily insight generated successfully", { requestId, userId: user.uid, latencyMs });
    metrics.recordApiRequest("/api/insights", 200, latencyMs);

    return NextResponse.json(
      { insight: data },
      {
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    metrics.recordApiRequest("/api/insights", 500, latencyMs);

    if (error instanceof DailyInsightQuotaError) {
      logger.warn("Daily insight quota exceeded", { requestId, userId: user.uid });
      return errorResponse(error.message, 429, requestId);
    }
    if (error instanceof DailyInsightError) {
      const status = error.kind === "configuration" ? 503 : error.kind === "quota" ? 429 : 502;
      logger.error("Daily insight provider error", { requestId, kind: error.kind, message: error.message, status });
      return errorResponse(error.message, status, requestId);
    }

    logger.error("Unhandled insight exception", { requestId, error: String(error) });
    return errorResponse("Không thể tạo nhận xét lúc này. Hãy thử lại sau.", 502, requestId);
  }
}
