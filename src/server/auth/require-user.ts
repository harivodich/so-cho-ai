import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { AppHttpError } from "@/server/http/errors";

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  isAnonymous: boolean;
};

export async function requireAuthenticatedUser(
  request: Request,
  allowAnonymous = false,
  customMessage?: string,
): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization");
  const idToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!idToken) {
    throw new AppHttpError(
      401,
      "UNAUTHORIZED",
      customMessage || "Bạn cần đăng nhập để dùng tính năng này.",
    );
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
    const isAnonymous = decoded.firebase?.sign_in_provider === "anonymous";
    if (isAnonymous && !allowAnonymous) {
      throw new AppHttpError(
        403,
        "FORBIDDEN",
        "Hãy đăng nhập tài khoản thật trước khi dùng tính năng này.",
      );
    }
    return {
      uid: decoded.uid,
      email: decoded.email,
      isAnonymous,
    };
  } catch (error) {
    if (error instanceof AppHttpError) {
      throw error;
    }
    const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code.startsWith("auth/")) {
      throw new AppHttpError(401, "UNAUTHORIZED", "Phiên đăng nhập không hợp lệ. Hãy tải lại trang.");
    }
    throw new AppHttpError(503, "SERVICE_UNCONFIGURED", "Không thể xác thực tài khoản trên server lúc này.");
  }
}
