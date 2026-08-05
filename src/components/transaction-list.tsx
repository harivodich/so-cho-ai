"use client";

import { formatVietnameseDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { ConfirmedTransaction, TransactionType } from "@/types/transaction";

type Props = {
  filter: "all" | TransactionType;
  onDelete: (transaction: ConfirmedTransaction) => void;
  onEdit: (transaction: ConfirmedTransaction) => void;
  onFilterChange: (filter: "all" | TransactionType) => void;
  transactions: ConfirmedTransaction[];
};

const labels: Record<TransactionType, string> = {
  sale: "Bán",
  purchase: "Nhập",
  expense: "Chi phí",
};

export function TransactionList({ filter, onDelete, onEdit, onFilterChange, transactions }: Props) {
  const visibleTransactions = filter === "all" ? transactions : transactions.filter((item) => item.type === filter);

  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sổ giao dịch</p>
          <h2 id="ledger-title">Các giao dịch đã xác nhận</h2>
        </div>
      </div>

      <div className="filter-row" aria-label="Lọc giao dịch">
        {(["all", "sale", "purchase", "expense"] as const).map((value) => (
          <button
            className={filter === value ? "filter-button selected" : "filter-button"}
            key={value}
            type="button"
            onClick={() => onFilterChange(value)}
          >
            {value === "all" ? "Tất cả" : labels[value]}
          </button>
        ))}
      </div>

      {visibleTransactions.length === 0 ? (
        <div className="empty-state">
          <p>Chưa có giao dịch phù hợp.</p>
          <span>Mỗi giao dịch chỉ xuất hiện tại đây sau khi bạn xác nhận lưu.</span>
        </div>
      ) : (
        <ul className="transaction-list">
          {visibleTransactions.map((transaction) => (
            <li key={transaction.id}>
              <div className={transaction.type === "sale" ? "transaction-marker income" : "transaction-marker expense"}>
                {transaction.type === "sale" ? "+" : "−"}
              </div>
              <div className="transaction-main">
                <strong>{transaction.itemName ?? labels[transaction.type]}</strong>
                <span>{labels[transaction.type]} · {formatVietnameseDate(transaction.occurredAt)}</span>
              </div>
              <div className="transaction-amount">
                <strong>{formatVnd(transaction.amount)}</strong>
                <div>
                  <button type="button" onClick={() => onEdit(transaction)}>Sửa</button>
                  <button type="button" onClick={() => onDelete(transaction)}>Xóa</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
