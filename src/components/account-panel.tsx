"use client";

import { useState, type FormEvent } from "react";
import type { User } from "firebase/auth";

import { UiIcon } from "@/components/ui-icon";

type Props = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
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
  const canSignIn = !user || user.isAnonymous;
  const localImportCount = localDataCount ?? localTransactionCount;

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

  async function continueWithGoogle() {
    if (user?.isAnonymous) {
      const confirmed = window.confirm(
        "Nếu tài khoản Google đã tồn tại, dữ liệu tạm sẽ không tự gộp. Hãy xuất backup trước khi tiếp tục.",
      );
      if (!confirmed) return;
    }
    await run(onGoogle);
  }

  async function continueWithExistingGoogle() {
    const confirmed = window.confirm(
      "Đăng nhập Google hiện có sẽ chuyển sang UID khác và không gộp dữ liệu phiên tạm. Hãy xuất backup trước khi tiếp tục.",
    );
    if (!confirmed) return;
    await run(onGoogleExisting);
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      setMessage("Nhập email và mật khẩu từ 6 ký tự trở lên.");
      return;
    }
    if (user?.isAnonymous && !createAccount) {
      const confirmed = window.confirm(
        "Đăng nhập tài khoản đã có sẽ chuyển sang UID khác. Hãy xuất backup trước nếu bạn cần giữ dữ liệu của phiên tạm. Tiếp tục?",
      );
      if (!confirmed) return;
    }
    await run(() => onEmail(email, password, createAccount));
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage("Nhập email trước khi yêu cầu đặt lại mật khẩu.");
      return;
    }
    await run(() => onResetPassword(email));
  }

  async function importLocal() {
    if (!window.confirm("Import older device data into this account? Records with matching IDs will be updated.")) return;
    await run(onImportLocal);
  }

  async function deleteAccount() {
    if (!window.confirm("Xóa tài khoản và toàn bộ dữ liệu của tài khoản này? Hành động không thể hoàn tác.")) return;
    await run(onDelete);
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
            onClick={() => void continueWithGoogle()}
          >
            <UiIcon name="check" size={18} /> Tiếp tục với Google
          </button>
          {user?.isAnonymous ? (
            <button
              className="secondary-button"
              type="button"
              disabled={isLoading || busy}
              onClick={() => void continueWithExistingGoogle()}
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
              Gửi lại email xác minh
            </button>
          ) : null}
          {localImportCount > 0 ? (
            <div className="account-import-notice">
              <span>Có {localImportCount} mục dữ liệu cũ đang lưu trên thiết bị này.</span>
              <button className="primary-button" type="button" disabled={busy} onClick={() => void importLocal()}>
                Nhập vào tài khoản
              </button>
            </div>
          ) : null}
          <div className="account-actions">
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void run(onSignOut)}>
              Đăng xuất
            </button>
            <button className="danger-button account-delete-button" type="button" disabled={busy} onClick={() => void deleteAccount()}>
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
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ban@example.com"
            />
          </label>
          <label>
            <span className="field-label">Mật khẩu</span>
            <input
              autoComplete={createAccount ? "new-password" : "current-password"}
              minLength={6}
              type="password"
              value={password}
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
            {createAccount ? "Tạo tài khoản" : "Đăng nhập"}
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

      {message ? <p className="account-message" role="status">{message}</p> : null}
      {error ? <p className="form-error" role="alert"><UiIcon name="alert" size={18} />{error}</p> : null}
    </section>
  );
}
