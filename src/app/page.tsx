"use client";

import { useRef, useState } from "react";

import { AccountPanel } from "@/components/account-panel";
import { ProductCatalogWorkspace } from "@/components/product-catalog-workspace";
import { DebtWorkspace } from "@/components/debt-workspace";
import { ConfirmationPanel } from "@/components/confirmation-panel";
import { ManualTransactionForm } from "@/components/manual-transaction-form";
import { ImageTransactionUploader } from "@/components/image-transaction-uploader";
import { ReportWorkspace } from "@/components/report-workspace";
import { TransactionList } from "@/components/transaction-list";
import { UiIcon } from "@/components/ui-icon";
import { VoiceTransactionRecorder } from "@/components/voice-transaction-recorder";
import { currentLocalDate, formatVietnameseDate } from "@/lib/date";
import { applyVoiceConfirmationDefaults } from "@/lib/voice-confirmation-defaults";
import { clearRevenueGoals } from "@/lib/revenue-goals";
import { createBackup, downloadBackup, parseBackup, reassignBackupOwner } from "@/lib/backup";
import { useAuth } from "@/hooks/use-auth";
import { useCatalog } from "@/hooks/use-catalog";
import { useCounterparties } from "@/hooks/use-counterparties";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useDebts } from "@/hooks/use-debts";
import { useTransactions } from "@/hooks/use-transactions";
import type {
  ConfirmedTransaction,
  InputMethod,
  TransactionDraft,
  TransactionType,
} from "@/types/transaction";

type View = "home" | "form" | "confirm" | "voice" | "image";
type ExtractResponse = { drafts?: unknown; error?: unknown };

function draftFromTransaction(transaction: ConfirmedTransaction): TransactionDraft {
  const {
    type,
    itemName,
    canonicalItemName,
    quantity,
    unit,
    unitPrice,
    amount,
    occurredAt,
    rawInput,
    fieldsNeedingReview,
    missingFields,
    warnings,
    qualityChecks,
  } = transaction;

  return {
    type,
    itemName,
    canonicalItemName,
    quantity,
    unit,
    unitPrice,
    amount,
    occurredAt,
    rawInput,
    fieldsNeedingReview,
    missingFields,
    warnings,
    qualityChecks,
    tax: transaction.tax,
  };
}
function newTransactionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractionError(payload: ExtractResponse | null): string | null {
  return typeof payload?.error === "string" ? payload.error : null;
}

export default function HomePage() {
  const auth = useAuth();
  const userScope = auth.user?.uid ?? null;
  const { clear, clearLocalForOwner: clearTransactionLocalForOwner, error, getIdToken, importLocalTransactions, localTransactionCount, persistence, remove, save, syncPending: transactionSyncPending, transactions } = useTransactions(userScope);
  const debts = useDebts(userScope);
  const catalog = useCatalog(userScope);
  const counterparties = useCounterparties(userScope);
  const syncPending = transactionSyncPending + debts.syncPending + catalog.syncPending + counterparties.syncPending;
  const localDataCount = localTransactionCount + catalog.localCatalogCount + debts.localDebtCount + counterparties.localCounterpartyCount;
  const [view, setView] = useState<View>("home");
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  const [pendingImageDrafts, setPendingImageDrafts] = useState<TransactionDraft[]>([]);
  const [editing, setEditing] = useState<ConfirmedTransaction | null>(null);
  const [draftInputMethod, setDraftInputMethod] = useState<InputMethod>("manual");
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [reportFocusDate, setReportFocusDate] = useState(currentLocalDate());
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const isRealAccount = persistence === "firebase" && Boolean(auth.user && !auth.user.isAnonymous);
  const aiAccessHint = isRealAccount ? undefined : 'Đăng nhập Google hoặc Email để dùng tính năng AI.';
  const online = useOnlineStatus();
  const dataError = error ?? debts.error;


  function startManualEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setPendingImageDrafts([]);
    setDraftInputMethod("manual");
    setView("form");
  }

  function startVoiceEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setPendingImageDrafts([]);
    setDraftInputMethod("voice");
    setView("voice");
  }

  function startImageEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setPendingImageDrafts([]);
    setDraftInputMethod("image");
    setView("image");
  }

  function preview(nextDraft: TransactionDraft) {
    setDraft(nextDraft);
    setView("confirm");
  }

  function editTransaction(transaction: ConfirmedTransaction) {
    setActionError(null);
    setEditing(transaction);
    setDraftInputMethod(transaction.inputMethod);
    setDraft(draftFromTransaction(transaction));
    setView("form");
  }

  async function analyzeVoice(audio: File) {
    const token = await getIdToken();
    const formData = new FormData();
    formData.set("mode", "voice");
    formData.set("audio", audio);

    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as ExtractResponse | null;
    if (!response.ok) {
      throw new Error(extractionError(payload) ?? "Không thể trích xuất giao dịch từ audio.");
    }
    if (!Array.isArray(payload?.drafts)) {
      throw new Error("AI không trả dữ liệu giao dịch hợp lệ. Hãy ghi lại hoặc nhập tay.");
    }
    if (payload.drafts.length === 0) {
      throw new Error("Chưa nghe thấy một giao dịch rõ ràng. Hãy nói ngắn gọn hơn hoặc nhập tay.");
    }
    if (payload.drafts.length !== 1) {
      throw new Error("Mỗi lần chỉ nên nói một giao dịch. Hãy ghi lại từng giao dịch riêng.");
    }

    setEditing(null);
    setDraftInputMethod("voice");
    setDraft(applyVoiceConfirmationDefaults(payload.drafts[0] as TransactionDraft, currentLocalDate()));
    setView("confirm");
  }

  async function analyzeImage(image: File) {
    const token = await getIdToken();
    const formData = new FormData();
    formData.set("mode", "image");
    formData.set("image", image);

    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as ExtractResponse | null;
    if (!response.ok) {
      throw new Error(extractionError(payload) ?? "Không thể đọc ảnh hóa đơn.");
    }
    if (!Array.isArray(payload?.drafts)) {
      throw new Error("AI không trả danh sách dòng hóa đơn hợp lệ. Hãy thử ảnh khác hoặc nhập tay.");
    }
    if (payload.drafts.length === 0) {
      throw new Error("Chưa đọc được dòng hàng rõ ràng. Hãy chụp hóa đơn in ngay ngắn, đủ sáng hoặc nhập tay.");
    }

    setEditing(null);
    setDraftInputMethod("image");
    setPendingImageDrafts(payload.drafts.slice(1) as TransactionDraft[]);
    setDraft(payload.drafts[0] as TransactionDraft);
    setView("confirm");
  }

  async function confirmSave() {
    if (!draft?.type || !draft.amount || !draft.occurredAt) {
      setActionError("Bản nháp chưa đủ loại giao dịch, tổng tiền hoặc ngày.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    const now = new Date().toISOString();
    const inputMethod: InputMethod = editing?.inputMethod ?? draftInputMethod;
    const transaction: ConfirmedTransaction = {
      ...draft,
      id: editing?.id ?? newTransactionId(),
      userId: editing?.userId ?? userScope ?? "local-device",
      inputMethod,
      type: draft.type,
      amount: draft.amount,
      occurredAt: draft.occurredAt,
      confirmedAt: editing?.confirmedAt ?? now,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    let transactionSaved = false;

    try {
      await save(transaction);
      transactionSaved = true;
      await catalog.syncTransaction(transaction);
      setReportFocusDate(transaction.occurredAt);
      if (inputMethod === "image" && pendingImageDrafts.length > 0) {
        setDraft(pendingImageDrafts[0]);
        setPendingImageDrafts((drafts) => drafts.slice(1));
        setEditing(null);
        setView("confirm");
      } else {
        setDraft(null);
        setPendingImageDrafts([]);
        setEditing(null);
        setView("home");
      }
    } catch (reason) {
      if (transactionSaved) setEditing(transaction);
      setActionError(
        transactionSaved
          ? reason instanceof Error ? `Đã lưu giao dịch nhưng chưa cập nhật tồn kho: ${reason.message}. Hãy thử lại.` : "Đã lưu giao dịch nhưng chưa cập nhật tồn kho. Hãy thử lại."
          : reason instanceof Error ? `Không thể lưu giao dịch: ${reason.message}` : "Không thể lưu giao dịch.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTransaction(transaction: ConfirmedTransaction) {
    if (!window.confirm(`Xóa giao dịch ${transaction.itemName ?? "này"}? Hành động này không thể hoàn tác.`)) {
      return;
    }

    setActionError(null);
    try {
      await remove(transaction.id);
      await catalog.removeTransaction(transaction.id);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? `Không thể xóa giao dịch: ${reason.message}` : "Không thể xóa giao dịch.",
      );
    }
  }

  async function clearData() {
    if (!window.confirm("Xóa toàn bộ giao dịch trên thiết bị/tài khoản này? Hành động này không thể hoàn tác.")) {
      return;
    }

    setActionError(null);
    try {
      await clear();
      clearRevenueGoals(auth.user?.uid ?? null);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? `Không thể xóa giao dịch: ${reason.message}` : "Không thể xóa giao dịch.",
      );
    }
  }

  async function handleAccountChange(operation: () => Promise<void>) {
    await operation();
    setAccountOpen(false);
  }

  function exportBackupFile() {
    downloadBackup(createBackup(transactions, debts.entries, catalog.products, catalog.movements, counterparties.items), `so-cho-ai-backup-${currentLocalDate()}.json`);
  }

  async function importBackupFile(file: File) {
    try {
      const backup = reassignBackupOwner(parseBackup(JSON.parse(await file.text())), userScope ?? "local-device");
      if (!window.confirm(`Nhập ${backup.transactions.length} giao dịch và ${backup.debts.length} khoản công nợ? Dữ liệu trùng mã sẽ được cập nhật.`)) return;
      const importedProducts = new Map<string, Awaited<ReturnType<typeof catalog.saveProduct>>>();
      for (const product of backup.products) {
        const savedProduct = await catalog.saveProduct({ id: product.id, userId: product.userId, name: product.name, defaultUnit: product.defaultUnit, lowStockThreshold: product.lowStockThreshold });
        importedProducts.set(product.id, savedProduct);
      }
      for (const transaction of backup.transactions) {
        await save(transaction);
        await catalog.syncTransaction(transaction);
      }
      for (const entry of backup.debts) await debts.save(entry);
      for (const counterparty of backup.counterparties) await counterparties.remember(counterparty.name);
      for (const movement of backup.stockMovements.filter((item) => item.kind === "adjustment" && item.sourceTransactionId === null)) {
        const product = importedProducts.get(movement.productId);
        if (product) await catalog.addAdjustment({ product, quantityDelta: movement.quantityDelta, reason: movement.reason ?? "Nhập từ backup", occurredAt: movement.occurredAt });
      }
      setActionError(null);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Không thể nhập tệp backup.");
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }
  const storageLabel =
    persistence === "firebase"
      ? "Đã kết nối Firebase"
      : persistence === "loading"
        ? "Đang kết nối Firebase"
        : "Lưu trên thiết bị";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup" aria-label="Sổ Chợ AI">
          <span className="brand-mark"><UiIcon name="book" size={18} /></span>
          <span>Sổ Chợ AI <small>MVP 0.1</small></span>
        </div>
        <div className="header-actions">
          <div className={persistence === "firebase" ? "storage-status connected" : "storage-status"}>
            {storageLabel}
          </div>
          <button className="secondary-button account-trigger" type="button" aria-expanded={accountOpen} aria-controls="account-panel" onClick={() => setAccountOpen((value) => !value)}>
            {auth.user && !auth.user.isAnonymous ? "Tài khoản" : "Đăng nhập"}
          </button>
        </div>
      </header>

      {accountOpen ? (
        <AccountPanel
          error={auth.error}
          isLoading={auth.isLoading}
          onDelete={() => handleAccountChange(async () => {
            const deletedOwner = auth.user?.uid ?? null;
            await auth.deleteAccount();
            if (deletedOwner) {
              await Promise.all([
                clearTransactionLocalForOwner(deletedOwner),
                debts.clearLocalForOwner(deletedOwner),
                catalog.clearLocalForOwner(deletedOwner),
                counterparties.clearLocalForOwner(deletedOwner),
              ]);
              clearRevenueGoals(deletedOwner);
            }
          })}
          onEmail={(email, password, create) => handleAccountChange(() => auth.signInEmail(email, password, create))}
          onImportLocal={() => handleAccountChange(async () => {
            await catalog.importLocalCatalog();
            const imported = await importLocalTransactions();
            for (const transaction of imported) await catalog.syncTransaction(transaction);
            await debts.importLocalDebts();
            await counterparties.importLocalCounterparties();
          })}
          localDataCount={localDataCount}
          localTransactionCount={localTransactionCount}
          onGoogle={() => handleAccountChange(auth.signInGoogle)}
          onGoogleExisting={() => handleAccountChange(auth.signInGoogleExisting)}
          onResetPassword={auth.resetPassword}
          onVerifyEmail={auth.verifyEmail}
          onSignOut={() => handleAccountChange(auth.signOut)}
          user={auth.user}
        />
      ) : null}

      <section className="hero" aria-labelledby="page-title">
        <h1 id="page-title">Ghi sổ gọn.<br />Biết rõ từng khoản.</h1>
        <p className="hero-copy">Nói hoặc gõ, rồi kiểm tra lại trước khi lưu. Không có giao dịch nào được tự động ghi vào sổ.</p>
      </section>

      {persistence === "local" ? (
        <aside className="local-notice">
          <UiIcon name="info" size={19} />
          <div>
            <strong>Đang lưu cục bộ</strong>
            <p>{error ? "Không thể kết nối Firebase. Giao dịch hiện chỉ được giữ trong trình duyệt này." : "Firebase chưa được cấu hình. Giao dịch hiện chỉ được giữ trong trình duyệt này."} Đừng xóa dữ liệu trình duyệt nếu còn cần các giao dịch này.</p>
          </div>
        </aside>
      ) : null}
      {dataError || actionError ? <p className="form-error" role="alert"><UiIcon name="alert" size={19} />{actionError ?? dataError}</p> : null}
      {!online ? <aside className="offline-notice" role="status"><UiIcon name="info" size={18} /><span>Đang offline. Dữ liệu mới sẽ lưu tạm và tự đồng bộ khi có mạng.</span></aside> : null}
      {syncPending > 0 ? <p className="sync-pending" role="status">Đang chờ đồng bộ {syncPending} thay đổi.</p> : null}

      {view === "home" ? (
        <>
          <section className="quick-entry" aria-labelledby="quick-entry-title">
            <div className="section-heading entry-heading">
              <div>
                <h2 id="quick-entry-title">Thêm giao dịch</h2>
                <p className="section-description">Chọn cách nhập phù hợp nhất với bạn.</p>
              </div>
            </div>
            <div className="entry-method-actions">
              <button className="entry-method entry-method-primary" type="button" onClick={startManualEntry}>
                <span className="entry-method-icon"><UiIcon name="plus" size={22} /></span>
                <span><strong>Nhập bằng tay</strong><small>Tự điền số tiền, mặt hàng và ngày giao dịch</small></span>
                <UiIcon className="entry-method-arrow" name="chevron-right" size={20} />
              </button>
              <button
                className="entry-method"
                type="button"
                onClick={startImageEntry}
                disabled={!isRealAccount}
                title={aiAccessHint}
              >
                <span className="entry-method-icon"><UiIcon name="image" size={21} /></span>
                <span><strong>Chụp hóa đơn in</strong><small>{isRealAccount ? "Tách từng dòng để bạn kiểm tra" : "Đăng nhập tài khoản để mở"}</small></span>
                <UiIcon className="entry-method-arrow" name="chevron-right" size={20} />
              </button>
              <button
                className="entry-method"
                type="button"
                onClick={startVoiceEntry}
                disabled={!isRealAccount}
                title={aiAccessHint}
              >
                <span className="entry-method-icon"><UiIcon name="microphone" size={21} /></span>
                <span><strong>Ghi bằng giọng nói</strong><small>{isRealAccount ? "AI tạo bản nháp để bạn kiểm tra" : "Đăng nhập tài khoản để mở"}</small></span>
                <UiIcon className="entry-method-arrow" name="chevron-right" size={20} />
              </button>
            </div>
            <p className="trust-note"><UiIcon name="check" size={17} /> Bạn luôn là người xác nhận trước khi giao dịch được lưu.</p>
          </section>

          <ProductCatalogWorkspace asOfDate={reportFocusDate} movements={catalog.movements} onAddAdjustment={catalog.addAdjustment} onSaveProduct={catalog.saveProduct} products={catalog.products} transactions={transactions} />
          <ReportWorkspace debts={debts.entries} key={reportFocusDate} focusDate={reportFocusDate} getIdToken={getIdToken} movements={catalog.movements} products={catalog.products} transactions={transactions} userId={isRealAccount ? userScope : null} />
          <DebtWorkspace userId={userScope} counterpartyNames={counterparties.names} entries={debts.entries} onRememberCounterparty={counterparties.remember} onRemove={debts.remove} onSave={debts.save} />
          <TransactionList
            filter={filter}
            onDelete={deleteTransaction}
            onEdit={editTransaction}
            onFilterChange={setFilter}
            transactions={transactions}
          />
          {transactions.length > 0 ? (
            <button className="danger-button" type="button" onClick={() => void clearData()}>
              <UiIcon name="trash" size={17} /> Xóa toàn bộ giao dịch của tôi
            </button>
          ) : null}
          <section className="backup-tools" aria-label="Sao lưu dữ liệu">
            <div><strong>Sao lưu dữ liệu</strong><span>Xuất hoặc nhập lại giao dịch và công nợ bằng tệp JSON.</span></div>
            <div className="backup-actions">
              <button className="secondary-button" type="button" onClick={exportBackupFile}>Xuất backup</button>
              <button className="secondary-button" type="button" onClick={() => backupInputRef.current?.click()}>Nhập backup</button>
              <input ref={backupInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackupFile(file); }} />
            </div>
          </section>
        </>
      ) : null}

      {view === "form" ? (
        <ManualTransactionForm
          initialDraft={draft}
          onCancel={() => {
            setDraft(null);
            setPendingImageDrafts([]);
            setEditing(null);
            setView("home");
          }}
          onPreview={preview}
        />
      ) : null}

      {view === "voice" ? <VoiceTransactionRecorder onAnalyze={analyzeVoice} onCancel={startManualEntry} /> : null}
      {view === "image" ? <ImageTransactionUploader onAnalyze={analyzeImage} onCancel={startManualEntry} /> : null}

      {view === "confirm" && draft ? (
        <ConfirmationPanel
          draft={draft}
          isSaving={isSaving}
          onEdit={() => setView("form")}
          onSave={() => void confirmSave()}
        />
      ) : null}

      <footer>
        <p>Lãi gộp chỉ là ước tính từ các giao dịch bạn đã xác nhận.</p>
        <p>{formatVietnameseDate(currentLocalDate())}</p>
      </footer>
    </main>
  );
}
