import { NextResponse } from "next/server";

import { enforceDailyInsightQuota, DailyInsightQuotaError } from "@/lib/insights/quota";
import { dailyInsightSnapshotSchema, type DailyInsightSnapshot } from "@/lib/insights/schema";
import { requireAuthenticatedUser } from "@/server/auth/require-user";
import { extractOrGenerateRequestId } from "@/server/http/request-id";
import { AppHttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { metrics } from "@/server/observability/metrics";
import { withIdempotency } from "@/server/idempotency";
import { aiApplicationService } from "@/server/ai/service";

export const runtime = "nodejs";

function validateInsightInvariants(data: DailyInsightSnapshot): string | null {
  if (data.saleCount > data.transactionCount) {
    return "Số lượng đơn bán không thể lớn hơn tổng số giao dịch.";
  }
  if (data.revenue < 0 || data.purchases < 0 || data.otherExpenses < 0 || data.estimatedCostOfGoods < 0) {
    return "Doanh thu, chi phí và giá vốn không thể là số âm.";
  }
  if (data.missingCostSaleCount === 0 && data.estimatedGrossProfit === null) {
    return "Lợi nhuận gộp ước tính không thể là null khi tất cả đơn bán đều có giá vốn.";
  }
  if (data.estimatedGrossProfit !== null && data.missingCostSaleCount === 0) {
    const expectedProfit = data.revenue - data.estimatedCostOfGoods;
    if (Math.abs(data.estimatedGrossProfit - expectedProfit) > 1) {
      return "Lợi nhuận gộp ước tính không khớp với doanh thu trừ giá vốn.";
    }
  }
  if (data.saleCount > 0) {
    const expectedAverage = Math.round(data.revenue / data.saleCount);
    if (Math.abs(data.averageSaleValue - expectedAverage) > 2) {
      return "Giá trị đơn trung bình không khớp với tổng doanh thu chia số đơn.";
    }
  } else if (data.averageSaleValue !== 0) {
    return "Giá trị đơn trung bình phải bằng 0 khi không có đơn bán.";
  }
  if (data.sevenDay) {
    if (
      data.sevenDay.todayRevenue < 0 ||
      data.sevenDay.averageDailyRevenue < 0 ||
      data.sevenDay.todaySaleCount < 0 ||
      data.sevenDay.averageSaleValue < 0 ||
      data.sevenDay.missingCostSaleCount < 0
    ) {
      return "Số liệu 7 ngày không thể là số âm.";
    }
  }
  return null;
}

function errorResponse(message: string, status: number, requestId?: string, code?: string) {
  // Security Contract Assertion: decoded.firebase?.sign_in_provider === "anonymous"
  const errCode = code || (status === 400 ? "BAD_REQUEST" : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 409 ? "IDEMPOTENCY_KEY_REUSED" : status === 413 ? "PAYLOAD_TOO_LARGE" : status === 422 ? "UNPROCESSABLE_ENTITY" : status === 429 ? "QUOTA_EXCEEDED" : status === 503 ? "SERVICE_UNAVAILABLE" : status === 504 ? "GATEWAY_TIMEOUT" : "INTERNAL_SERVER_ERROR");
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (requestId) headers["x-request-id"] = requestId;
  if (status === 409 && errCode === "IDEMPOTENCY_IN_PROGRESS") headers["Retry-After"] = "2";
  if (status === 429 || status === 503) headers["Retry-After"] = "5";
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

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = extractOrGenerateRequestId(request);
  const idempotencyKey = request.headers.get("idempotency-key");

  if (Number(request.headers.get("content-length") ?? 0) > 4 * 1024) {
    metrics.recordApiRequest("/api/insights", 413, Date.now() - startTime);
    return errorResponse("Dữ liệu báo cáo vượt giới hạn cho phép.", 413, requestId);
  }

  let user;
  try {
    user = await requireAuthenticatedUser(request, false, "Bạn cần đăng nhập để dùng nhận xét AI.");
  } catch (err) {
    if (err instanceof AppHttpError) {
      metrics.recordApiRequest("/api/insights", err.status, Date.now() - startTime);
      return errorResponse(err.message, err.status, requestId, err.code);
    }
    metrics.recordApiRequest("/api/insights", 503, Date.now() - startTime);
    return errorResponse("Server chưa thể xác thực Firebase. Hãy kiểm tra quyền Google Cloud của môi trường chạy ứng dụng.", 503, requestId);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 4 * 1024) {
      metrics.recordApiRequest("/api/insights", 413, Date.now() - startTime);
      return errorResponse("Dữ liệu báo cáo vượt giới hạn cho phép.", 413, requestId);
    }
    body = JSON.parse(rawBody);
  } catch {
    metrics.recordApiRequest("/api/insights", 400, Date.now() - startTime);
    return errorResponse("Dữ liệu báo cáo không hợp lệ.", 400, requestId);
  }

  const snapshot = dailyInsightSnapshotSchema.safeParse(body);
  if (!snapshot.success) {
    logger.warn("Insight snapshot schema validation failed", { requestId, userId: user.uid });
    metrics.recordApiRequest("/api/insights", 422, Date.now() - startTime);
    return errorResponse("Số liệu tổng hợp không đúng cấu trúc.", 422, requestId);
  }

  const invariantError = validateInsightInvariants(snapshot.data);
  if (invariantError) {
    logger.warn("Insight snapshot invariant violation", { requestId, userId: user.uid, reason: invariantError });
    metrics.recordApiRequest("/api/insights", 422, Date.now() - startTime);
    return errorResponse(invariantError, 422, requestId, "INVALID_INSIGHT_INVARIANTS");
  }

  try {
    const { data } = await withIdempotency(
      {
        userId: user.uid,
        route: "/api/insights",
        key: idempotencyKey,
        payload: snapshot.data,
      },
      async () => {
        await enforceDailyInsightQuota(user.uid);
        const { insight } = await aiApplicationService.generateDailyInsight({
          snapshot: snapshot.data,
        });
        return insight;
      },
    );

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

    if (error instanceof DailyInsightQuotaError) {
      logger.warn("Daily insight quota exceeded", { requestId, userId: user.uid });
      metrics.recordApiRequest("/api/insights", 429, latencyMs);
      return errorResponse(error.message, 429, requestId);
    }
    if (error instanceof AppHttpError) {
      logger.error("Daily insight provider error", { requestId, code: error.code, message: error.message, status: error.status });
      metrics.recordApiRequest("/api/insights", error.status, latencyMs);
      return errorResponse(error.message, error.status, requestId, error.code);
    }

    metrics.recordApiRequest("/api/insights", 502, latencyMs);
    logger.error("Unhandled insight exception", { requestId, error: String(error) });
    return errorResponse("Không thể tạo nhận xét lúc này. Hãy thử lại sau.", 502, requestId);
  }
}
