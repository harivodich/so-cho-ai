import { NextResponse } from "next/server";

import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authenticatedUserId(request: Request): Promise<string | NextResponse> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return errorResponse("Bạn cần đăng nhập để xóa tài khoản.", 401);

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token, true);
    return decoded.uid;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.startsWith("auth/")) {
      return errorResponse("Phiên đăng nhập không hợp lệ. Hãy tải lại trang.", 401);
    }
    return errorResponse("Server chưa thể xác thực Firebase. Hãy thử lại sau.", 503);
  }
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId(request);
  if (userId instanceof NextResponse) return userId;

  try {
    const db = getFirebaseAdminDb();
    await db.recursiveDelete(db.doc("users/" + userId));
    await getFirebaseAdminAuth().deleteUser(userId);
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Chưa thể xác nhận xóa tài khoản hoàn toàn. Hãy thử lại sau.", 503);
  }
}