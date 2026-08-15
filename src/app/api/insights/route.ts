import { NextResponse } from "next/server";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { generateDailyInsight, DailyInsightError } from "@/lib/insights/gemini";
import { enforceDailyInsightQuota, DailyInsightQuotaError } from "@/lib/insights/quota";
import { dailyInsightSnapshotSchema } from "@/lib/insights/schema";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authenticatedUserId(request: Request): Promise<string | NextResponse> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return errorResponse("Bạn cần đăng nhập để dùng nhận xét AI.", 401);
  try {
    return (await getFirebaseAdminAuth().verifyIdToken(token, true)).uid;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.startsWith("auth/")) {
      return errorResponse("Phiên đăng nhập không hợp lệ. Hãy tải lại trang.", 401);
    }
    return errorResponse("Server chưa thể xác thực Firebase. Hãy kiểm tra quyền Google Cloud của môi trường chạy ứng dụng.", 503);
  }
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4 * 1024) {
    return errorResponse("Dữ liệu báo cáo vượt giới hạn cho phép.", 413);
  }
  const userId = await authenticatedUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 4 * 1024) {
      return errorResponse("Dữ liệu báo cáo vượt giới hạn cho phép.", 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Dữ liệu báo cáo không hợp lệ.", 400);
  }
  const snapshot = dailyInsightSnapshotSchema.safeParse(body);
  if (!snapshot.success) return errorResponse("Số liệu tổng hợp không đúng cấu trúc.", 422);

  try {
    await enforceDailyInsightQuota(userId);
    const insight = await generateDailyInsight(snapshot.data);
    return NextResponse.json({ insight }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DailyInsightQuotaError) return errorResponse(error.message, 429);
    if (error instanceof DailyInsightError) {
      const status = error.kind === "configuration" ? 503 : error.kind === "quota" ? 429 : 502;
      return errorResponse(error.message, status);
    }
    return errorResponse("Không thể tạo nhận xét lúc này. Báo cáo số liệu vẫn dùng được bình thường.", 502);
  }
}
