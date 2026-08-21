"use client";

import { useMemo, useState } from "react";

import { UiIcon } from "@/components/ui-icon";
import { currentLocalDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { triggerHapticFeedback } from "@/lib/haptic";
import { debtPaidAmount, debtRemainingAmount, summarizeDebtLedger, type DebtDirection, type DebtEntry } from "@/types/debt";

type Props = {
  entries: DebtEntry[];
  counterpartyNames?: string[];
  onRememberCounterparty?: (name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onSave: (entry: DebtEntry) => Promise<void>;
  userId?: string | null;
};

type DebtFilter = "all" | "overdue" | "open" | "settled";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "debt-" + Date.now();
}

function daysDiff(from: string, to: string): number {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  return Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24));
}

export function DebtWorkspace({ entries, counterpartyNames = [], onRememberCounterparty, onRemove, onSave, userId }: Props) {
  const [partyName, setPartyName] = useState("");
  const [direction, setDirection] = useState<DebtDirection>("receivable");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debtFilter, setDebtFilter] = useState<DebtFilter>("all");

  const today = currentLocalDate();
  const summary = useMemo(() => summarizeDebtLedger(entries, today), [entries, today]);

  // Sort: Overdue first (longest overdue first), then approaching due date, then settled
  const sortedAndFilteredEntries = useMemo(() => {
    const scored = entries.map((entry) => {
      const remaining = debtRemainingAmount(entry);
      const isSettled = entry.status === "settled" || remaining === 0;
      const isOverdue = !isSettled && entry.dueDate !== null && entry.dueDate < today;
      const overdueDays = isOverdue && entry.dueDate ? daysDiff(entry.dueDate, today) : 0;
      const remainingDays = !isSettled && entry.dueDate && !isOverdue ? daysDiff(today, entry.dueDate) : null;

      let sortRank = 2; // normal open
      if (isOverdue) sortRank = 0; // highest priority
      else if (isSettled) sortRank = 3; // lowest priority

      return {
        entry,
        remaining,
        isSettled,
        isOverdue,
        overdueDays,
        remainingDays,
        sortRank,
      };
    });

    // Apply Filter
    const filtered = scored.filter((item) => {
      if (debtFilter === "overdue") return item.isOverdue;
      if (debtFilter === "open") return !item.isSettled;
      if (debtFilter === "settled") return item.isSettled;
      return true;
    });

    // Sort by priority rank, then overdue days desc, then updated date desc
    return filtered.sort((left, right) => {
      if (left.sortRank !== right.sortRank) return left.sortRank - right.sortRank;
      if (left.isOverdue && right.isOverdue) return right.overdueDays - left.overdueDays;
      if (left.remainingDays !== null && right.remainingDays !== null) return left.remainingDays - right.remainingDays;
      return right.entry.updatedAt.localeCompare(left.entry.updatedAt);
    });
  }, [debtFilter, entries, today]);

  const overdueCount = useMemo(() => {
    return entries.filter((e) => {
      const remaining = debtRemainingAmount(e);
      return e.status !== "settled" && remaining > 0 && e.dueDate !== null && e.dueDate < today;
    }).length;
  }, [entries, today]);

  const openCount = useMemo(() => {
    return entries.filter((e) => e.status !== "settled" && debtRemainingAmount(e) > 0).length;
  }, [entries]);

  const settledCount = useMemo(() => {
    return entries.filter((e) => e.status === "settled" || debtRemainingAmount(e) === 0).length;
  }, [entries]);

  async function addEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(/[^0-9]/g, ""));
    if (!partyName.trim() || !Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      setError("Nhập tên đối tác và số tiền nguyên VND lớn hơn 0.");
      return;
    }
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    try {
      await onSave({
        id: newId(),
        userId: userId ?? "local-device",
        partyName: partyName.trim(),
        direction,
        amount: parsedAmount,
        dueDate: dueDate || null,
        note: note.trim(),
        status: "open",
        paidAmount: 0,
        payments: [],
        createdAt: now,
        updatedAt: now,
      });
      await onRememberCounterparty?.(partyName);
      triggerHapticFeedback([30, 20]);
      setPartyName("");
      setAmount("");
      setDueDate("");
      setNote("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu công nợ.");
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(entry: DebtEntry) {
    const parsedAmount = Number(paymentAmount.replace(/[^0-9]/g, ""));
    const remaining = debtRemainingAmount(entry);
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0 || parsedAmount > remaining) {
      setError("Số tiền thanh toán phải từ 1 đến " + formatVnd(remaining) + ".");
      return;
    }
    setBusy(true);
    setError(null);
    const payment = { id: newId(), amount: parsedAmount, paidAt: currentLocalDate(), note: paymentNote.trim() };
    const nextPaid = debtPaidAmount(entry) + parsedAmount;
    try {
      await onSave({
        ...entry,
        paidAmount: nextPaid,
        payments: [...(entry.payments ?? []), payment],
        status: nextPaid >= entry.amount ? "settled" : "partial",
        updatedAt: new Date().toISOString(),
      });
      triggerHapticFeedback([40, 20]);
      setPaymentFor(null);
      setPaymentAmount("");
      setPaymentNote("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể ghi thanh toán.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(entryId: string) {
    if (!window.confirm("Xóa khoản công nợ này?")) return;
    setBusy(true);
    setError(null);
    try {
      await onRemove(entryId);
      triggerHapticFeedback(20);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa công nợ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="debt-workspace" aria-labelledby="debt-title">
      <div className="inventory-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ DÒNG TIỀN</span>
          <h2 id="debt-title">Sổ công nợ</h2>
          <p>Ghi khoản phải thu/phải trả riêng, không trộn lẫn với doanh thu.</p>
        </div>
      </div>

      <div className="debt-summary">
        <div>
          <span>Phải thu còn lại</span>
          <strong style={{ color: "var(--green-dark)" }}>{formatVnd(summary.receivable)}</strong>
        </div>
        <div>
          <span>Phải trả còn lại</span>
          <strong style={{ color: "#b91c1c" }}>{formatVnd(summary.payable)}</strong>
        </div>
        <div>
          <span>Chưa xong</span>
          <strong>{openCount}</strong>
        </div>
        <div className={overdueCount > 0 ? "debt-summary-overdue" : ""}>
          <span>Quá hạn</span>
          <strong style={{ color: overdueCount > 0 ? "#dc2626" : "inherit" }}>
            {overdueCount} {overdueCount > 0 ? "⚠️" : ""}
          </strong>
        </div>
      </div>

      <form className="debt-form" onSubmit={(event) => void addEntry(event)}>
        <label>
          <span>Đối tác</span>
          <input list="counterparty-options" value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder="Tên khách/nhà cung cấp" required />
        </label>
        <datalist id="counterparty-options">
          {counterpartyNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <label>
          <span>Loại</span>
          <select value={direction} onChange={(event) => setDirection(event.target.value as DebtDirection)}>
            <option value="receivable">Phải thu (Khách nợ mình)</option>
            <option value="payable">Phải trả (Mình nợ mối)</option>
          </select>
        </label>
        <label>
          <span>Số tiền gốc (VND)</span>
          <input inputMode="numeric" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="500.000" required />
        </label>
        <label>
          <span>Hạn thanh toán</span>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label className="debt-note-field">
          <span>Ghi chú</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: hẹn trả vào thứ 6" />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          Thêm khoản công nợ
        </button>
      </form>

      {error ? <p className="form-error" role="alert"><UiIcon name="alert" size={19} />{error}</p> : null}

      {/* Debt Status Filter Switch */}
      {entries.length > 0 ? (
        <div className="debt-filter-bar" role="group" aria-label="Lọc trạng thái công nợ">
          <button
            type="button"
            className={debtFilter === "all" ? "active" : ""}
            onClick={() => {
              triggerHapticFeedback(15);
              setDebtFilter("all");
            }}
          >
            Tất cả ({entries.length})
          </button>
          <button
            type="button"
            className={debtFilter === "overdue" ? "active is-overdue" : "is-overdue"}
            onClick={() => {
              triggerHapticFeedback(15);
              setDebtFilter("overdue");
            }}
          >
            Quá hạn ({overdueCount})
          </button>
          <button
            type="button"
            className={debtFilter === "open" ? "active" : ""}
            onClick={() => {
              triggerHapticFeedback(15);
              setDebtFilter("open");
            }}
          >
            Chưa trả ({openCount})
          </button>
          <button
            type="button"
            className={debtFilter === "settled" ? "active" : ""}
            onClick={() => {
              triggerHapticFeedback(15);
              setDebtFilter("settled");
            }}
          >
            Đã xong ({settledCount})
          </button>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="debt-list">
          {sortedAndFilteredEntries.length === 0 ? (
            <p className="inventory-empty">Không có khoản nợ nào khớp với bộ lọc &quot;{debtFilter}&quot;.</p>
          ) : (
            sortedAndFilteredEntries.map(({ entry, remaining, isSettled, isOverdue, overdueDays, remainingDays }) => {
              return (
                <article
                  className={`debt-item ${isSettled ? "settled" : ""} ${isOverdue ? "is-overdue-card" : ""}`}
                  key={entry.id}
                >
                  <div className="debt-item-info">
                    <div className="debt-item-header">
                      <strong>{entry.partyName}</strong>
                      {isSettled ? (
                        <span className="debt-badge settled">Đã tất toán</span>
                      ) : isOverdue ? (
                        <span className="debt-badge overdue">Quá hạn {overdueDays} ngày</span>
                      ) : remainingDays === 0 ? (
                        <span className="debt-badge due-today">Đến hạn hôm nay</span>
                      ) : remainingDays !== null ? (
                        <span className="debt-badge on-time">Còn {remainingDays} ngày</span>
                      ) : null}
                    </div>

                    <span className="debt-item-meta">
                      <b style={{ color: entry.direction === "receivable" ? "var(--green-dark)" : "#dc2626" }}>
                        {entry.direction === "receivable" ? "Khách nợ" : "Nợ mối"}
                      </b>
                      {entry.dueDate ? ` · Hạn: ${entry.dueDate}` : ""}
                    </span>

                    {entry.note ? <small className="debt-note-text">{entry.note}</small> : null}
                    <div className="debt-progress-text">
                      Đã trả: {formatVnd(debtPaidAmount(entry))} · <strong>Còn lại: {formatVnd(remaining)}</strong>
                    </div>
                  </div>

                  <div className="debt-item-actions">
                    <b className="debt-original-amount">{formatVnd(entry.amount)}</b>
                    {remaining > 0 ? (
                      <button
                        className="secondary-button payment-trigger-btn"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          triggerHapticFeedback(15);
                          setPaymentFor(entry.id);
                          setPaymentAmount("");
                          setError(null);
                        }}
                      >
                        Thu/Trả
                      </button>
                    ) : (
                      <span className="debt-settled-text">Xong</span>
                    )}
                    <button
                      className="text-button delete-debt-btn"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeEntry(entry.id)}
                      title="Xóa bản ghi"
                    >
                      <UiIcon name="trash" size={14} />
                    </button>
                  </div>

                  {paymentFor === entry.id && remaining > 0 ? (
                    <div className="debt-payment-form">
                      <label>
                        <span>Số tiền thu/trả thêm (Tối đa {formatVnd(remaining)})</span>
                        <input
                          autoFocus
                          inputMode="numeric"
                          min="1"
                          max={remaining}
                          value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          placeholder={String(remaining)}
                          required
                        />
                      </label>
                      <label>
                        <span>Ghi chú thanh toán</span>
                        <input
                          value={paymentNote}
                          onChange={(event) => setPaymentNote(event.target.value)}
                          placeholder="Tiền mặt, Chuyển khoản, Đổi hàng..."
                        />
                      </label>
                      <div className="payment-form-buttons">
                        <button
                          className="primary-button"
                          type="button"
                          disabled={busy}
                          onClick={() => void recordPayment(entry)}
                        >
                          Lưu thanh toán
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={busy}
                          onClick={() => setPaymentFor(null)}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      ) : (
        <p className="inventory-empty">Chưa có khoản công nợ nào.</p>
      )}
    </section>
  );
}