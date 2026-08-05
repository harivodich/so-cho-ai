"use client";

import { useMemo, useState } from "react";

import { ConfirmationPanel } from "@/components/confirmation-panel";
import { DailyReport } from "@/components/daily-report";
import { ManualTransactionForm } from "@/components/manual-transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { currentLocalDate, formatVietnameseDate } from "@/lib/date";
import { calculateDailyReport } from "@/lib/reports";
import { useTransactions } from "@/hooks/use-transactions";
import type {
  ConfirmedTransaction,
  InputMethod,
  TransactionDraft,
  TransactionType,
} from "@/types/transaction";

type View = "home" | "form" | "confirm";

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
  };
}

function newTransactionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function HomePage() {
  const { clear, error, persistence, remove, save, transactions } = useTransactions();
  const [view, setView] = useState<View>("home");
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  const [editing, setEditing] = useState<ConfirmedTransaction | null>(null);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [selectedDate, setSelectedDate] = useState(currentLocalDate());
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const report = useMemo(
    () => calculateDailyReport(transactions, selectedDate),
    [selectedDate, transactions],
  );

  function startManualEntry() {
    setActionError(null);
    setEditing(null);
    setDraft(null);
    setView("form");
  }

  function preview(nextDraft: TransactionDraft) {
    setDraft(nextDraft);
    setView("confirm");
  }

  function editTransaction(transaction: ConfirmedTransaction) {
    setActionError(null);
    setEditing(transaction);
    setDraft(draftFromTransaction(transaction));
    setView("form");
  }

  async function confirmSave() {
    if (!draft?.type || !draft.amount || !draft.occurredAt) {
      setActionError("Bản nháp chưa đủ loại giao dịch, tổng tiền hoặc ngày.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    const now = new Date().toISOString();
    const inputMethod: InputMethod = editing?.inputMethod ?? "manual";
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
      setSelectedDate(transaction.occurredAt);
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
    } catch (reason) {
      setActionError(
        reason instanceof Error ? `Không thể xóa dữ liệu: ${reason.message}` : "Không thể xóa dữ liệu.",
      );
    }
  }

  if (persistence === "loading") {
    return <main className="loading-shell">Đang chuẩn bị sổ giao dịch…</main>;
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">SỔ CHỢ AI · MVP 0.1</p>
          <h1>Ghi sổ nhanh, biết rõ điều gì đã được tính.</h1>
          <p className="hero-copy">Mọi giao dịch đều cần bạn kiểm tra trước khi lưu.</p>
        </div>
        <div className={persistence === "firebase" ? "storage-status connected" : "storage-status"}>
          {persistence === "firebase" ? "Đã kết nối Firebase" : "Đang lưu trên thiết bị này"}
        </div>
      </header>

      {persistence === "local" ? (
        <aside className="local-notice">
          Firebase chưa được cấu hình nên dữ liệu chỉ lưu trong trình duyệt hiện tại. Đừng xóa dữ liệu trình duyệt nếu còn cần các giao dịch này.
        </aside>
      ) : null}
      {error || actionError ? <p className="form-error" role="alert">{actionError ?? error}</p> : null}

      {view === "home" ? (
        <>
          <section className="quick-entry" aria-labelledby="quick-entry-title">
            <div>
              <p className="eyebrow">Bắt đầu</p>
              <h2 id="quick-entry-title">Bạn muốn ghi giao dịch thế nào?</h2>
            </div>
            <button className="primary-button" type="button" onClick={startManualEntry}>Nhập giao dịch</button>
            <p className="coming-soon">Ghi bằng giọng nói và ảnh hóa đơn sẽ được mở sau khi luồng nhập tay được kiểm thử ổn định.</p>
          </section>

          <section className="date-picker-section" aria-label="Chọn ngày báo cáo">
            <label>
              Xem báo cáo ngày
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </section>
          <DailyReport report={report} />
          <TransactionList
            filter={filter}
            onDelete={deleteTransaction}
            onEdit={editTransaction}
            onFilterChange={setFilter}
            transactions={transactions}
          />
          {transactions.length > 0 ? (
            <button className="danger-button" type="button" onClick={() => void clearData()}>
              Xóa toàn bộ dữ liệu của tôi
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

      {view === "confirm" && draft ? (
        <ConfirmationPanel
          draft={draft}
          isSaving={isSaving}
          onEdit={() => setView("form")}
          onSave={() => void confirmSave()}
        />
      ) : null}

      <footer>
        <p>Kết quả lãi gộp chỉ là ước tính theo dữ liệu đã xác nhận.</p>
        <p>Hôm nay: {formatVietnameseDate(currentLocalDate())}</p>
      </footer>
    </main>
  );
}
