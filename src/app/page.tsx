"use client";

import { useRef, useState } from "react";

import { AccountPanel } from "@/components/account-panel";
import { AppShell, type AppTab } from "@/components/app-shell";
import { ProductCatalogWorkspace } from "@/components/product-catalog-workspace";
import { DebtWorkspace } from "@/components/debt-workspace";
import { ConfirmationPanel } from "@/components/confirmation-panel";
import { ManualTransactionForm } from "@/components/manual-transaction-form";
import { ImageTransactionUploader } from "@/components/image-transaction-uploader";
import { ReportWorkspace } from "@/components/report-workspace";
import { TransactionList } from "@/components/transaction-list";
import { UiIcon } from "@/components/ui-icon";
import { VoiceTransactionRecorder } from "@/components/voice-transaction-recorder";
import { currentLocalDate } from "@/lib/date";
import { triggerHapticFeedback } from "@/lib/haptic";
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
  const {
    clearLocalForOwner: clearTransactionLocalForOwner,
    error,
    getIdToken,
    importLocalTransactions,
    localTransactionCount,
    persistence,
    remove,
    save,
    syncPending: transactionSyncPending,
    transactions,
  } = useTransactions(userScope);

  const debts = useDebts(userScope);
  const catalog = useCatalog(userScope);
  const counterparties = useCounterparties(userScope);
  const syncPending = transactionSyncPending + debts.syncPending + catalog.syncPending + counterparties.syncPending;
  const localDataCount = localTransactionCount + catalog.localCatalogCount + debts.localDebtCount + counterparties.localCounterpartyCount;

  const [activeTab, setActiveTab] = useState<AppTab>("entry");
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
  const aiAccessHint = isRealAccount ? undefined : "Đăng nhập Google hoặc Email để dùng tính năng AI.";
  const online = useOnlineStatus();
  const dataError = error ?? debts.error;

  async function handleAccountChange(operation: () => Promise<void>) {
    await operation();
    setAccountOpen(false);
  }

  function startManualEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setPendingImageDrafts([]);
    setDraftInputMethod("manual");
    setView("form");
    setActiveTab("entry");
  }

  function startVoiceEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setPendingImageDrafts([]);
    setDraftInputMethod("voice");
    setView("voice");
    setActiveTab("entry");
  }

  function startImageEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setPendingImageDrafts([]);
    setDraftInputMethod("image");
    setView("image");
    setActiveTab("entry");
  }

  function preview(nextDraft: TransactionDraft) {
    setDraft(nextDraft);
    setView("confirm");
    setActiveTab("entry");
  }

  function editTransaction(transaction: ConfirmedTransaction) {
    setActionError(null);
    setEditing(transaction);
    setDraftInputMethod(transaction.inputMethod);
    setDraft(draftFromTransaction(transaction));
    setView("form");
    setActiveTab("entry");
  }

  async function analyzeVoice(audio: File) {
    const token = await getIdToken();
    const formData = new FormData();
    formData.set("mode", "voice");
    formData.set("audio", audio);

    const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const response = await fetch("/api/extract", {
      method: "POST",
      headers,
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

    const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined;
    const headers: Record<string, string> = { Authorization: "Bearer " + token };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const response = await fetch("/api/extract", {
      method: "POST",
      headers,
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
      triggerHapticFeedback([40, 30, 40]);
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
        reason instanceof Error ? `Đã lưu giao dịch nhưng chưa cập nhật tồn kho: ${reason.message}` : "Đã lưu giao dịch nhưng chưa cập nhật tồn kho.",
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
      triggerHapticFeedback(20);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? `Không thể xóa giao dịch: ${reason.message}` : "Không thể xóa giao dịch.",
      );
    }
  }

  function exportBackupData() {
    const backup = createBackup(
      transactions,
      debts.entries,
      catalog.products,
      catalog.movements,
      counterparties.items,
    );
    downloadBackup(backup, `so-cho-ai-backup-${currentLocalDate()}.json`);
    triggerHapticFeedback(15);
  }

  async function importBackupFile(file: File) {
    setActionError(null);
    try {
      const backup = reassignBackupOwner(parseBackup(JSON.parse(await file.text())), userScope ?? "local-device");
      if (!window.confirm(`Nhập ${backup.transactions.length} giao dịch và ${backup.debts.length} khoản công nợ? Dữ liệu trùng mã sẽ được cập nhật.`)) return;

      const importedProducts = new Map<string, Awaited<ReturnType<typeof catalog.saveProduct>>>();
      for (const product of backup.products) {
        const savedProduct = await catalog.saveProduct(product);
        importedProducts.set(product.id, savedProduct);
      }
      for (const t of backup.transactions) {
        await save(t);
        await catalog.syncTransaction(t);
      }
      for (const d of backup.debts) await debts.save(d);
      for (const c of backup.counterparties) await counterparties.remember(c.name);
      for (const movement of backup.stockMovements.filter((m) => m.kind === "adjustment" && m.sourceTransactionId === null)) {
        const product = importedProducts.get(movement.productId);
        if (product) {
          await catalog.addAdjustment({ product, quantityDelta: movement.quantityDelta, reason: movement.reason ?? "Nhập từ backup", occurredAt: movement.occurredAt });
        }
      }
      triggerHapticFeedback([30, 20, 30]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Nhập bản sao lưu thất bại.");
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        if (tab !== "entry") setView("home");
      }}
      onQuickVoice={startVoiceEntry}
      isVoiceDisabled={Boolean(aiAccessHint)}
      voiceDisabledReason={aiAccessHint}
      header={
        <header className="app-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <UiIcon name="pencil" size={20} />
            </span>
            <div>
              <strong>Sổ Chợ AI</strong>
              <small>PRO PLATFORM</small>
            </div>
          </div>

          <div className="header-actions">
            <span className={`storage-status ${persistence === "local" ? "local" : "cloud"}`}>
              {!online ? "Ngoại tuyến" : persistence === "local" ? "Dữ liệu máy" : syncPending > 0 ? `Đang đồng bộ (${syncPending})` : "Đã đồng bộ"}
            </span>
            <button
              className="text-button account-trigger"
              type="button"
              onClick={() => setAccountOpen(!accountOpen)}
              aria-expanded={accountOpen}
              aria-controls="account-panel"
            >
              <UiIcon name="pencil" size={16} />
              Tài khoản
            </button>
          </div>
        </header>
      }
    >
      {/* Account Drawer Panel */}
      {accountOpen ? (
        <div id="account-panel">
          <AccountPanel
            error={auth.error}
            isLoading={auth.isLoading}
            onDelete={() => handleAccountChange(async () => {
              const deletedOwner = userScope;
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
        </div>
      ) : null}

      {/* Global Alerts & Notices */}
      {dataError ? (
        <p className="form-error" role="alert">
          <UiIcon name="alert" size={19} />
          {dataError}
        </p>
      ) : null}

      {actionError ? (
        <p className="form-error" role="alert">
          <UiIcon name="alert" size={19} />
          {actionError}
        </p>
      ) : null}

      {!online ? (
        <p className="offline-notice" role="status">
          <UiIcon name="alert" size={16} /> Đang ngoại tuyến. Dữ liệu ghi trên máy sẽ tự đồng bộ khi có mạng.
        </p>
      ) : null}

      {/* TAB 1: ENTRY HUB */}
      {activeTab === "entry" ? (
        <div>
          {view === "voice" ? (
            <VoiceTransactionRecorder
              onAnalyze={analyzeVoice}
              onCancel={startManualEntry}
            />
          ) : view === "image" ? (
            <ImageTransactionUploader
              onAnalyze={analyzeImage}
              onCancel={startManualEntry}
            />
          ) : view === "form" ? (
            <ManualTransactionForm
              initialDraft={draft}
              products={catalog.products}
              transactions={transactions}
              onCancel={() => {
                setDraft(null);
                setPendingImageDrafts([]);
                setEditing(null);
                setView("home");
              }}
              onPreview={preview}
            />
          ) : view === "confirm" && draft ? (
            <ConfirmationPanel
              draft={draft}
              isSaving={isSaving}
              onEdit={() => setView("form")}
              onSave={() => void confirmSave()}
            />
          ) : (
            <section className="quick-entry" aria-labelledby="quick-entry-title">
              <div className="section-heading">
                <div>
                  <h1 id="quick-entry-title">Ghi chép giao dịch</h1>
                  <p className="section-description">
                    Chọn cách thuận tiện nhất: bấm nói bằng giọng nói AI, quét hóa đơn ảnh hoặc tự nhập số liệu.
                  </p>
                </div>
                <span className="review-badge">
                  <UiIcon name="check" size={15} /> Xác nhận trước khi lưu
                </span>
              </div>

              <div className="entry-method-actions">
                <button
                  className="entry-method entry-method-primary"
                  type="button"
                  onClick={startVoiceEntry}
                  disabled={Boolean(aiAccessHint)}
                >
                  <span className="entry-method-icon" aria-hidden="true">
                    <UiIcon name="microphone" size={22} />
                  </span>
                  <div>
                    <strong>Nói để ghi sổ</strong>
                    <small>{aiAccessHint ?? "Bấm và nói: 'Bán 2 ký xoài, 80 nghìn' trong 30 giây."}</small>
                  </div>
                  <span className="entry-method-arrow" aria-hidden="true">→</span>
                </button>

                <button
                  className="entry-method"
                  type="button"
                  onClick={startImageEntry}
                  disabled={Boolean(aiAccessHint)}
                >
                  <span className="entry-method-icon" aria-hidden="true">
                    <UiIcon name="image" size={20} />
                  </span>
                  <div>
                    <strong>Chụp hóa đơn / Phiếu</strong>
                    <small>{aiAccessHint ?? "Đọc hóa đơn bán lẻ, biên nhận nhiều dòng thành bản nháp."}</small>
                  </div>
                  <span className="entry-method-arrow" aria-hidden="true">→</span>
                </button>

                <button
                  className="entry-method"
                  type="button"
                  onClick={startManualEntry}
                >
                  <span className="entry-method-icon" aria-hidden="true">
                    <UiIcon name="plus" size={20} />
                  </span>
                  <div>
                    <strong>Tự nhập tay</strong>
                    <small>Chọn nhanh loại bán/nhập/chi, gợi ý mặt hàng và phím tắt tiền.</small>
                  </div>
                  <span className="entry-method-arrow" aria-hidden="true">→</span>
                </button>
              </div>

              <div className="trust-note">
                <UiIcon name="check" size={14} />
                <span>AI chỉ tạo bản nháp kiểm tra; bạn luôn có quyền chỉnh sửa trước khi lưu vào sổ.</span>
              </div>
            </section>
          )}
        </div>
      ) : null}

      {/* TAB 2: LEDGER VIEW */}
      {activeTab === "ledger" ? (
        <div>
          <TransactionList
            filter={filter}
            onDelete={deleteTransaction}
            onEdit={editTransaction}
            onFilterChange={setFilter}
            transactions={transactions}
          />

          <div className="backup-tools">
            <div>
              <strong>Sao lưu & Phục hồi dữ liệu</strong>
              <span>Xuất dữ liệu an toàn về máy dạng JSON hoặc nhập lại dữ liệu khi đổi thiết bị.</span>
            </div>
            <div className="backup-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={exportBackupData}
              >
                <UiIcon name="book" size={15} /> Xuất sao lưu
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => backupInputRef.current?.click()}
              >
                <UiIcon name="plus" size={15} /> Nhập sao lưu
              </button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importBackupFile(file);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 3: REPORTS & INSIGHTS */}
      {activeTab === "reports" ? (
        <ReportWorkspace
          debts={debts.entries}
          focusDate={reportFocusDate}
          getIdToken={getIdToken}
          movements={catalog.movements}
          products={catalog.products}
          transactions={transactions}
          userId={isRealAccount ? userScope : null}
        />
      ) : null}

      {/* TAB 4: INVENTORY & CATALOG */}
      {activeTab === "inventory" ? (
        <ProductCatalogWorkspace
          asOfDate={reportFocusDate}
          movements={catalog.movements}
          onAddAdjustment={catalog.addAdjustment}
          onSaveProduct={catalog.saveProduct}
          products={catalog.products}
          transactions={transactions}
        />
      ) : null}

      {/* TAB 5: DEBTS & CASH FLOW */}
      {activeTab === "debts" ? (
        <DebtWorkspace
          userId={userScope}
          counterpartyNames={counterparties.names}
          entries={debts.entries}
          onRememberCounterparty={counterparties.remember}
          onRemove={debts.remove}
          onSave={debts.save}
        />
      ) : null}
    </AppShell>
  );
}
