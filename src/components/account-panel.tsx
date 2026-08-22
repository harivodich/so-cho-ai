"use client";

import { useState, useRef, type FormEvent } from "react";
import type { User } from "firebase/auth";

import { UiIcon } from "@/components/ui-icon";
import { AccessibleDialog, type DialogVariant } from "@/components/ui/dialog";
import type { AuthUiError } from "@/lib/firebase/auth-errors";

type Props = {
  user: User | null;
  isLoading: boolean;
  error: string | AuthUiError | null;
  onGoogle: () => Promise<void>;
  onGoogleExisting: () => Promise<void>;
  onEmail: (email: string, password: string, create: boolean) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onVerifyEmail: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDelete: () => Promise<void>;
  onImportLocal: () => Promise<void>;
  localTransactionCount: number;
  localDataCount?: number;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  variant: DialogVariant;
  action: () => Promise<void>;
};

export function AccountPanel({
  user,
  isLoading,
  error,
  onGoogle,
  onGoogleExisting,
  onEmail,
  onResetPassword,
  onVerifyEmail,
  onSignOut,
  onDelete,
  onImportLocal,
  localTransactionCount,
  localDataCount,
}: Props) {
  const [showEmail, setShowEmail] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const canSignIn = !user || user.isAnonymous;
  const localImportCount = localDataCount ?? localTransactionCount;

  const authError: AuthUiError | null =
    typeof error === "string"
      ? { code: "auth/unknown", message: error, field: "form" }
      : error;

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await operation();
      setMessage("Đã cập nhật tài khoản.");
    } catch {
      // Auth hook owns the detailed error shown below.
    } finally {
      setBusy(false);
    }
  }

  function handleGoogleLogin() {
    if (user?.isAnonymous) {
      setConfirmDialog({
        title: "Chuyển đổi sang tài khoản Google",
        description: "Nếu tài khoản Google đã tồn tại, dữ liệu tạm trên thiết bị này sẽ không tự gộp. Bạn nên xuất bản sao lưu trước khi tiếp tục.",
        confirmLabel: "Tiếp tục với Google",
        variant: "warning",
        action: () => run(onGoogle),
      });
      return;
    }
    void run(onGoogle);
  }

  function handleExistingGoogleLogin() {
    // Note: Replaced raw window.confirm with AccessibleDialog for accessibility
    setConfirmDialog({
      title: "Đăng nhập Google hiện có",
      description: "Đăng nhập tài khoản Google có sẵn sẽ chuyển sang UID khác và không gộp dữ liệu của phiên tạm. Hãy xuất bản sao lưu trước nếu bạn cần giữ sổ này.",
      confirmLabel: "Chuyển tài khoản",
      variant: "warning",
      action: () => run(onGoogleExisting),
    });
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      setMessage("Nhập email và mật khẩu từ 6 ký tự trở lên.");
      return;
    }
    if (user?.isAnonymous && !createAccount) {
      setConfirmDialog({
        title: "Đăng nhập tài khoản Email",
        description: "Đăng nhập tài khoản đã có sẽ chuyển sang UID khác. Hãy xuất bản sao lưu trước nếu bạn cần giữ dữ liệu của phiên tạm.",
        confirmLabel: "Đăng nhập",
        variant: "warning",
        action: () => run(() => onEmail(email, password, createAccount)),
      });
      return;
    }
    await run(() => onEmail(email, password, createAccount));
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage("Nhập email trước khi yêu cầu đặt lại mật khẩu.");
      return;
    }
    await run(() => onResetPassword(email));
    setMessage("Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư đến (và thư mục spam).");
  }

  function handleImportLocal() {
    setConfirmDialog({
      title: "Nhập dữ liệu từ thiết bị",
      description: `Nhập ${localImportCount} mục dữ liệu cũ đang lưu trên thiết bị này vào tài khoản đám mây? Dữ liệu trùng mã sẽ được cập nhật.`,
      confirmLabel: "Tiến hành nhập",
      variant: "info",
      action: () => run(onImportLocal),
    });
  }

  function handleDeleteAccount() {
    setConfirmDialog({
      title: "Xóa vĩnh viễn tài khoản",
      description: "Xóa tài khoản và toàn bộ dữ liệu giao dịch, công nợ, kho hàng của tài khoản này? Hành động này không thể hoàn tác.",
      confirmLabel: "Xóa tài khoản",
      variant: "danger",
      action: () => run(onDelete),
    });
  }

  function switchToLoginMode() {
    setCreateAccount(false);
    setMessage(null);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  }

  return (
    <section id="account-panel" className="account-panel" aria-labelledby="account-title">
      <div className="account-heading">
        <div>
          <span className="eyebrow">TÀI KHOẢN</span>
          <h2 id="account-title">Dữ liệu của bạn</h2>
        </div>
        <UiIcon name="info" size={21} />
      </div>

      {canSignIn ? (
        <>
          <p className="account-status">
            <strong>{user?.isAnonymous ? "Đang dùng tài khoản tạm" : "Đăng nhập để đồng bộ dữ liệu"}</strong>
            <span>
              {user?.isAnonymous
                ? "Dữ liệu đang gắn với trình duyệt này. Nâng cấp để dùng trên thiết bị khác mà không mất sổ."
                : "Tài khoản thật giúp dữ liệu thuộc về bạn và mở các tính năng AI."}
            </span>
          </p>
          <button
            className="primary-button account-google-button"
            type="button"
            disabled={isLoading || busy}
            onClick={handleGoogleLogin}
          >
            <UiIcon name="check" size={18} /> {busy ? "Đang xử lý..." : "Tiếp tục với Google"}
          </button>
          {user?.isAnonymous ? (
            <button
              className="secondary-button"
              type="button"
              disabled={isLoading || busy}
              onClick={handleExistingGoogleLogin}
            >
              Đăng nhập Google hiện có
            </button>
          ) : null}
          <button
            className="text-button account-email-toggle"
            type="button"
            disabled={busy}
            onClick={() => setShowEmail((value) => !value)}
          >
            {showEmail ? "Ẩn đăng nhập email" : "Dùng email và mật khẩu"}
          </button>
        </>
      ) : user ? (
        <>
          <p className="account-status connected">
            <strong>{user.displayName || user.email || "Tài khoản đã đăng nhập"}</strong>
            <span>{user.email ?? "Đăng nhập bằng Google"}</span>
          </p>
          {user.email && !user.emailVerified ? (
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void run(onVerifyEmail)}>
              {busy ? "Đang gửi..." : "Gửi lại email xác minh"}
            </button>
          ) : null}
          {localImportCount > 0 ? (
            <div className="account-import-notice">
              <span>Có {localImportCount} mục dữ liệu cũ đang lưu trên thiết bị này.</span>
              <button className="primary-button" type="button" disabled={busy} onClick={handleImportLocal}>
                Nhập vào tài khoản
              </button>
            </div>
          ) : null}
          <div className="account-actions">
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void run(onSignOut)}>
              Đăng xuất
            </button>
            <button className="danger-button account-delete-button" type="button" disabled={busy} onClick={handleDeleteAccount}>
              Xóa tài khoản
            </button>
          </div>
        </>
      ) : null}

      {showEmail && canSignIn ? (
        <form className="account-email-form" onSubmit={(event) => void submitEmail(event)}>
          <label>
            <span className="field-label">Email</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              aria-invalid={authError?.field === "email"}
              aria-describedby={authError ? "auth-feedback-msg" : undefined}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ban@example.com"
            />
          </label>
          <label>
            <span className="field-label">Mật khẩu</span>
            <input
              ref={passwordInputRef}
              autoComplete={createAccount ? "new-password" : "current-password"}
              minLength={6}
              type="password"
              value={password}
              aria-invalid={authError?.field === "password"}
              aria-describedby={authError ? "auth-feedback-msg" : undefined}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ít nhất 6 ký tự"
            />
          </label>
          {!createAccount && user?.isAnonymous ? (
            <p className="account-migration-warning">
              <UiIcon name="info" size={16} /> Đăng nhập tài khoản có sẵn sẽ chuyển UID. Nếu cần giữ dữ liệu tạm, hãy xuất backup rồi nhập lại sau khi đăng nhập.
            </p>
          ) : null}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? (createAccount ? "Đang tạo tài khoản..." : "Đang đăng nhập...") : (createAccount ? "Tạo tài khoản" : "Đăng nhập")}
          </button>
          <div className="account-form-links">
            <button className="text-button" type="button" onClick={() => setCreateAccount((value) => !value)}>
              {createAccount ? "Đã có tài khoản? Đăng nhập" : "Tạo tài khoản mới"}
            </button>
            {!createAccount ? (
              <button className="text-button" type="button" onClick={() => void resetPassword()} disabled={busy}>
                Quên mật khẩu?
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {/* Structured Friendly Auth Feedback */}
      {authError ? (
        <div className="auth-feedback-box is-error" role="alert">
          <div className="auth-feedback-header">
            <UiIcon name="alert" size={18} />
            <span id="auth-feedback-msg">{authError.message}</span>
          </div>
          {authError.action === "switch-to-login" && createAccount ? (
            <div className="auth-feedback-actions">
              <button
                type="button"
                className="secondary-button feedback-action-btn"
                onClick={switchToLoginMode}
              >
                Chuyển sang Đăng nhập
              </button>
              <button
                type="button"
                className="text-button feedback-action-btn"
                onClick={() => void resetPassword()}
                disabled={busy}
              >
                Đặt lại mật khẩu
              </button>
            </div>
          ) : authError.action === "reset-password" ? (
            <div className="auth-feedback-actions">
              <button
                type="button"
                className="secondary-button feedback-action-btn"
                onClick={() => void resetPassword()}
                disabled={busy}
              >
                Gửi email đặt lại mật khẩu
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="account-message" role="status">{message}</p> : null}

      {/* Accessible Confirmation Modal Dialog */}
      <AccessibleDialog
        isOpen={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? "Xác nhận"}
        description={confirmDialog?.description}
        variant={confirmDialog?.variant ?? "default"}
      >
        <div className="modal-confirm-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setConfirmDialog(null)}
            disabled={busy}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className={confirmDialog?.variant === "danger" ? "danger-button" : "primary-button"}
            onClick={async () => {
              const currentAction = confirmDialog?.action;
              setConfirmDialog(null);
              if (currentAction) await currentAction();
            }}
            disabled={busy}
          >
            {confirmDialog?.confirmLabel ?? "Đồng ý"}
          </button>
        </div>
      </AccessibleDialog>
    </section>
  );
}
