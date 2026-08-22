export type AuthErrorCode =
  | "auth/email-already-in-use"
  | "auth/invalid-email"
  | "auth/weak-password"
  | "auth/wrong-password"
  | "auth/user-not-found"
  | "auth/invalid-credential"
  | "auth/too-many-requests"
  | "auth/network-request-failed"
  | "auth/credential-already-in-use"
  | "auth/popup-closed-by-user"
  | "auth/user-disabled"
  | "auth/requires-recent-login"
  | "auth/unknown";

export type AuthUiError = {
  code: string;
  message: string;
  field?: "email" | "password" | "form";
  action?: "switch-to-login" | "reset-password" | "retry" | "export-first";
  rawMessage?: string;
};

export function extractFirebaseErrorCode(error: unknown): string {
  if (!error) return "auth/unknown";
  if (typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/auth\/[a-z0-9-]+/i);
  return match ? match[0].toLowerCase() : "auth/unknown";
}

export function toAuthUiError(error: unknown): AuthUiError {
  if (!error) {
    return {
      code: "auth/unknown",
      message: "Đã xảy ra lỗi không xác định. Vui lòng thử lại.",
      field: "form",
    };
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const code = extractFirebaseErrorCode(error);

  switch (code) {
    case "auth/email-already-in-use":
      return {
        code,
        message: "Email này đã được đăng ký. Bạn có thể chuyển sang Đăng nhập bằng mật khẩu hiện có hoặc đặt lại mật khẩu.",
        field: "email",
        action: "switch-to-login",
        rawMessage,
      };
    case "auth/invalid-email":
      return {
        code,
        message: "Địa chỉ email chưa đúng định dạng. Vui lòng kiểm tra lại.",
        field: "email",
        action: "retry",
        rawMessage,
      };
    case "auth/weak-password":
      return {
        code,
        message: "Mật khẩu quá ngắn. Vui lòng nhập mật khẩu tối thiểu 6 ký tự.",
        field: "password",
        action: "retry",
        rawMessage,
      };
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return {
        code,
        message: "Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra lại hoặc dùng Quên mật khẩu.",
        field: "password",
        action: "reset-password",
        rawMessage,
      };
    case "auth/too-many-requests":
      return {
        code,
        message: "Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.",
        field: "form",
        action: "retry",
        rawMessage,
      };
    case "auth/network-request-failed":
      return {
        code,
        message: "Không thể kết nối máy chủ xác thực. Vui lòng kiểm tra kết nối mạng và thử lại.",
        field: "form",
        action: "retry",
        rawMessage,
      };
    case "auth/credential-already-in-use":
      return {
        code,
        message: "Email hoặc tài khoản này đã được sử dụng. Hãy đăng nhập tài khoản đó hoặc sao lưu dữ liệu trước khi chuyển.",
        field: "form",
        action: "export-first",
        rawMessage,
      };
    case "auth/popup-closed-by-user":
      return {
        code,
        message: "Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.",
        field: "form",
        action: "retry",
        rawMessage,
      };
    case "auth/user-disabled":
      return {
        code,
        message: "Tài khoản này hiện đang bị tạm khóa. Vui lòng liên hệ quản trị viên.",
        field: "form",
        rawMessage,
      };
    case "auth/requires-recent-login":
      return {
        code,
        message: "Thao tác quan trọng yêu cầu bạn đăng nhập lại trước khi tiếp tục.",
        field: "form",
        action: "switch-to-login",
        rawMessage,
      };
    default: {
      const fallbackMessage =
        rawMessage && !rawMessage.includes("Firebase:") && !rawMessage.includes("auth/")
          ? rawMessage
          : "Không thể hoàn tất thao tác tài khoản lúc này. Vui lòng thử lại sau.";
      return {
        code,
        message: fallbackMessage,
        field: "form",
        action: "retry",
        rawMessage,
      };
    }
  }
}
