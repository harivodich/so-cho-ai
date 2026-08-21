import { NextResponse } from "next/server";

import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";
import { extractOrGenerateRequestId } from "@/server/http/request-id";
import { logger } from "@/server/observability/logger";
import { metrics } from "@/server/observability/metrics";

export const runtime = "nodejs";

function errorResponse(message: string, status: number, requestId?: string) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (requestId) headers["x-request-id"] = requestId;
  return NextResponse.json({ error: message }, { status, headers });
}

async function authenticatedUserId(request: Request, requestId: string): Promise<string | NextResponse> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return errorResponse("Bạn cần đăng nhập để xóa tài khoản.", 401, requestId);

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token, true);
    return decoded.uid;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.startsWith("auth/")) {
      return errorResponse("Phiên đăng nhập không hợp lệ. Hãy tải lại trang.", 401, requestId);
    }
    return errorResponse("Server chưa thể xác thực Firebase. Hãy thử lại sau.", 503, requestId);
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = extractOrGenerateRequestId(request);
  const userId = await authenticatedUserId(request, requestId);
  if (userId instanceof NextResponse) return userId;

  try {
    logger.info("Starting account deletion job", { requestId, userId });
    const db = getFirebaseAdminDb();
    await db.recursiveDelete(db.doc("users/" + userId));
    await getFirebaseAdminAuth().deleteUser(userId);

    const latencyMs = Date.now() - startTime;
    logger.info("Account deletion completed successfully", { requestId, userId, latencyMs });
    metrics.recordApiRequest("/api/account/delete", 200, latencyMs);

    return NextResponse.json(
      { deleted: true },
      { headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logger.error("Account deletion failed", { requestId, userId, error: String(error), latencyMs });
    metrics.recordApiRequest("/api/account/delete", 503, latencyMs);
    return errorResponse("Chưa thể xác nhận xóa tài khoản hoàn toàn. Hãy thử lại sau.", 503, requestId);
  }
}