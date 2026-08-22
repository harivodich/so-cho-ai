import { describe, expect, it } from "vitest";
import {
  extractFirebaseErrorCode,
  toAuthUiError,
} from "@/lib/firebase/auth-errors";

describe("Firebase Auth Error Translation & UX Protection", () => {
  it("extracts clean error code from various Firebase error patterns", () => {
    expect(extractFirebaseErrorCode(new Error("Firebase: Error (auth/email-already-in-use)."))).toBe(
      "auth/email-already-in-use",
    );
    expect(extractFirebaseErrorCode({ code: "auth/invalid-email", message: "Bad email" })).toBe(
      "auth/invalid-email",
    );
    expect(extractFirebaseErrorCode("FirebaseError: auth/wrong-password")).toBe("auth/wrong-password");
    expect(extractFirebaseErrorCode(new Error("Network timeout"))).toBe("auth/unknown");
  });

  it("maps auth/email-already-in-use to friendly Vietnamese message with switch-to-login action", () => {
    const error = new Error("Firebase: Error (auth/email-already-in-use).");
    const uiError = toAuthUiError(error);

    expect(uiError.code).toBe("auth/email-already-in-use");
    expect(uiError.message).toContain("Email này đã được đăng ký");
    expect(uiError.message).not.toContain("Firebase: Error");
    expect(uiError.field).toBe("email");
    expect(uiError.action).toBe("switch-to-login");
  });

  it("maps auth/weak-password to password field instruction", () => {
    const uiError = toAuthUiError({ code: "auth/weak-password" });
    expect(uiError.message).toContain("Mật khẩu quá ngắn");
    expect(uiError.field).toBe("password");
    expect(uiError.action).toBe("retry");
  });

  it("maps auth/invalid-email to email field correction", () => {
    const uiError = toAuthUiError(new Error("Firebase: Error (auth/invalid-email)."));
    expect(uiError.message).toContain("Địa chỉ email chưa đúng định dạng");
    expect(uiError.field).toBe("email");
  });

  it("maps wrong-password and user-not-found to secure generic message with reset-password action", () => {
    const wrongPass = toAuthUiError({ code: "auth/wrong-password" });
    const userNotFound = toAuthUiError({ code: "auth/user-not-found" });
    const invalidCred = toAuthUiError({ code: "auth/invalid-credential" });

    expect(wrongPass.message).toContain("Email hoặc mật khẩu chưa chính xác");
    expect(wrongPass.action).toBe("reset-password");

    expect(userNotFound.message).toContain("Email hoặc mật khẩu chưa chính xác");
    expect(userNotFound.action).toBe("reset-password");

    expect(invalidCred.message).toContain("Email hoặc mật khẩu chưa chính xác");
    expect(invalidCred.action).toBe("reset-password");
  });

  it("maps network failures and rate limits gracefully", () => {
    const networkError = toAuthUiError(new Error("Firebase: Error (auth/network-request-failed)."));
    const rateLimit = toAuthUiError({ code: "auth/too-many-requests" });

    expect(networkError.message).toContain("Không thể kết nối máy chủ xác thực");
    expect(rateLimit.message).toContain("quá nhiều lần");
  });

  it("maps credential-already-in-use for anonymous linking with export-first guidance", () => {
    const uiError = toAuthUiError({ code: "auth/credential-already-in-use" });
    expect(uiError.message).toContain("Email hoặc tài khoản này đã được sử dụng");
    expect(uiError.action).toBe("export-first");
  });

  it("provides safe Vietnamese fallback for unknown errors without raw Firebase technical strings", () => {
    const rawError = new Error("Firebase: Error (auth/internal-error).");
    const uiError = toAuthUiError(rawError);
    expect(uiError.message).not.toContain("Firebase: Error");
    expect(uiError.message).toContain("Không thể hoàn tất thao tác tài khoản lúc này");
  });
});
