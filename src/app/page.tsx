"use client";

import { useState } from "react";

import { ConfirmationPanel } from "@/components/confirmation-panel";
import { ManualTransactionForm } from "@/components/manual-transaction-form";
import { ReportWorkspace } from "@/components/report-workspace";
import { TransactionList } from "@/components/transaction-list";
import { UiIcon } from "@/components/ui-icon";
import { VoiceTransactionRecorder } from "@/components/voice-transaction-recorder";
import { currentLocalDate, formatVietnameseDate } from "@/lib/date";
import { applyVoiceConfirmationDefaults } from "@/lib/voice-confirmation-defaults";
import { clearRevenueGoals } from "@/lib/revenue-goals";
import { useTransactions } from "@/hooks/use-transactions";
import type {
  ConfirmedTransaction,
  InputMethod,
  TransactionDraft,
  TransactionType,
} from "@/types/transaction";

type View = "home" | "form" | "confirm" | "voice";
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
  const { clear, error, getIdToken, persistence, remove, save, transactions } = useTransactions();
  const [view, setView] = useState<View>("home");
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  const [editing, setEditing] = useState<ConfirmedTransaction | null>(null);
  const [draftInputMethod, setDraftInputMethod] = useState<InputMethod>("manual");
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [reportFocusDate, setReportFocusDate] = useState(currentLocalDate());
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);


  function startManualEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setDraftInputMethod("manual");
    setView("form");
  }

  function startVoiceEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setDraftInputMethod("voice");
    setView("voice");
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
      userId: editing?.userId ?? (persistence === "firebase" ? "firebase-user" : "local-device"),
      inputMethod,
      type: draft.type,
      amount: draft.amount,
      occurredAt: draft.occurredAt,
      confirmedAt: editing?.confirmedAt ?? now,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await save(transaction);
      setReportFocusDate(transaction.occurredAt);
      setDraft(null);
      setEditing(null);
      setView("home");
    } catch (reason) {
      setActionError(
        reason instanceof Error ? `Không thể lưu giao dịch: ${reason.message}` : "Không thể lưu giao dịch.",
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
      clearRevenueGoals();
    } catch (reason) {
      setActionError(
        reason instanceof Error ? `Không thể xóa dữ liệu: ${reason.message}` : "Không thể xóa dữ liệu.",
      );
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
        <div className={persistence === "firebase" ? "storage-status connected" : "storage-status"}>
          {storageLabel}
        </div>
      </header>

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
      {error || actionError ? <p className="form-error" role="alert"><UiIcon name="alert" size={19} />{actionError ?? error}</p> : null}

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
                onClick={startVoiceEntry}
                disabled={persistence !== "firebase"}
                title={persistence !== "firebase" ? "Cần kết nối Firebase trước khi ghi bằng giọng nói." : undefined}
              >
                <span className="entry-method-icon"><UiIcon name="microphone" size={21} /></span>
                <span><strong>Ghi bằng giọng nói</strong><small>{persistence === "firebase" ? "AI tạo bản nháp để bạn kiểm tra" : "Mở sau khi Firebase được kết nối"}</small></span>
                <UiIcon className="entry-method-arrow" name="chevron-right" size={20} />
              </button>
            </div>
            <p className="trust-note"><UiIcon name="check" size={17} /> Bạn luôn là người xác nhận trước khi giao dịch được lưu.</p>
          </section>

          <ReportWorkspace key={reportFocusDate} focusDate={reportFocusDate} getIdToken={getIdToken} transactions={transactions} />
          <TransactionList
            filter={filter}
            onDelete={deleteTransaction}
            onEdit={editTransaction}
            onFilterChange={setFilter}
            transactions={transactions}
          />
          {transactions.length > 0 ? (
            <button className="danger-button" type="button" onClick={() => void clearData()}>
              <UiIcon name="trash" size={17} /> Xóa toàn bộ dữ liệu của tôi
            </button>
          ) : null}
        </>
      ) : null}

      {view === "form" ? (
        <ManualTransactionForm
          initialDraft={draft}
          onCancel={() => {
            setDraft(null);
            setEditing(null);
            setView("home");
          }}
          onPreview={preview}
        />
      ) : null}

      {view === "voice" ? <VoiceTransactionRecorder onAnalyze={analyzeVoice} onCancel={startManualEntry} /> : null}

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
