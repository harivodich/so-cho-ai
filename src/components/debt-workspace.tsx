"use client";

import { useMemo, useState } from "react";

import { currentLocalDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { debtPaidAmount, debtRemainingAmount, summarizeDebtLedger, type DebtDirection, type DebtEntry } from "@/types/debt";

type Props = {
  entries: DebtEntry[];
  counterpartyNames?: string[];
  onRememberCounterparty?: (name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onSave: (entry: DebtEntry) => Promise<void>;
  userId?: string | null;
};

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "debt-" + Date.now();
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
  const summary = useMemo(() => summarizeDebtLedger(entries, currentLocalDate()), [entries]);

  async function addEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
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
    const parsedAmount = Number(paymentAmount);
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
    setBusy(true);
    setError(null);
    try {
      await onRemove(entryId);
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
          <p>Ghi khoản phải thu/phải trả riêng, không trộn với doanh thu.</p>
        </div>
      </div>

      <div className="debt-summary">
        <div><span>Phải thu còn lại</span><strong>{formatVnd(summary.receivable)}</strong></div>
        <div><span>Phải trả còn lại</span><strong>{formatVnd(summary.payable)}</strong></div>
        <div><span>Đang mở</span><strong>{summary.openCount}</strong></div>
        <div><span>Quá hạn</span><strong>{summary.overdueCount}</strong></div>
      </div>

      <form className="debt-form" onSubmit={(event) => void addEntry(event)}>
        <label><span>Đối tác</span><input list="counterparty-options" value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder="Tên khách/nhà cung cấp" /></label>
        <datalist id="counterparty-options">{counterpartyNames.map((name) => <option key={name} value={name} />)}</datalist>
        <label><span>Loại</span><select value={direction} onChange={(event) => setDirection(event.target.value as DebtDirection)}><option value="receivable">Phải thu</option><option value="payable">Phải trả</option></select></label>
        <label><span>Số tiền gốc (VND)</span><input inputMode="numeric" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="500000" /></label>
        <label><span>Hạn thanh toán</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <label className="debt-note-field"><span>Ghi chú</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: giao đủ hàng ngày mai" /></label>
        <button className="primary-button" type="submit" disabled={busy}>Thêm khoản công nợ</button>
      </form>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {entries.length > 0 ? (
        <div className="debt-list">
          {entries.map((entry) => {
            const remaining = debtRemainingAmount(entry);
            const overdue = entry.dueDate !== null && entry.dueDate < currentLocalDate() && remaining > 0;
            return (
              <article className={entry.status === "settled" ? "debt-item settled" : "debt-item"} key={entry.id}>
                <div>
                  <strong>{entry.partyName}</strong>
                  <span>{entry.direction === "receivable" ? "Phải thu" : "Phải trả"}{entry.dueDate ? " · hạn " + entry.dueDate : ""}{overdue ? " · quá hạn" : ""}</span>
                  {entry.note ? <small>{entry.note}</small> : null}
                  <small>Đã thanh toán {formatVnd(debtPaidAmount(entry))} · Còn lại {formatVnd(remaining)}</small>
                </div>
                <div className="debt-item-actions">
                  <b>{formatVnd(entry.amount)}</b>
                  {remaining > 0 ? <button className="text-button" type="button" disabled={busy} onClick={() => { setPaymentFor(entry.id); setPaymentAmount(""); setError(null); }}>Thanh toán</button> : <span>Đã tất toán</span>}
                  <button className="text-button" type="button" disabled={busy} onClick={() => void removeEntry(entry.id)}>Xóa</button>
                </div>
                {paymentFor === entry.id && remaining > 0 ? (
                  <div className="debt-payment-form">
                    <label><span>Số tiền trả thêm</span><input autoFocus inputMode="numeric" min="1" max={remaining} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
                    <label><span>Ghi chú</span><input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Tiền mặt/chuyển khoản" /></label>
                    <button className="primary-button" type="button" disabled={busy} onClick={() => void recordPayment(entry)}>Lưu thanh toán</button>
                    <button className="secondary-button" type="button" disabled={busy} onClick={() => setPaymentFor(null)}>Hủy</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : <p className="inventory-empty">Chưa có khoản công nợ nào.</p>}
    </section>
  );
}