"use client";

import { UiIcon, type IconName } from "@/components/ui-icon";
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

const icons: Record<TransactionType, IconName> = {
  sale: "sale",
  purchase: "purchase",
  expense: "expense",
};

export function TransactionList({ filter, onDelete, onEdit, onFilterChange, transactions }: Props) {
  const visibleTransactions = filter === "all" ? transactions : transactions.filter((item) => item.type === filter);

  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="section-heading ledger-heading">
        <div>
          <h2 id="ledger-title">Sổ giao dịch</h2>
          <p className="section-description">Chỉ hiện các giao dịch bạn đã xác nhận lưu.</p>
        </div>
      </div>

      <div className="filter-row" aria-label="Lọc giao dịch">
        {(["all", "sale", "purchase", "expense"] as const).map((value) => (
          <button
            aria-pressed={filter === value}
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
          <span className="empty-state-icon"><UiIcon name="book" size={24} /></span>
          <p>Chưa có giao dịch phù hợp</p>
          <span>Giao dịch sẽ xuất hiện ở đây sau khi bạn xác nhận lưu.</span>
        </div>
      ) : (
        <ul className="transaction-list">
          {visibleTransactions.map((transaction) => (
            <li key={transaction.id}>
              <div className={`transaction-marker ${transaction.type}`}>
                <UiIcon name={icons[transaction.type]} size={19} />
              </div>
              <div className="transaction-main">
                <strong>{transaction.itemName ?? labels[transaction.type]}</strong>
                <span>{labels[transaction.type]} · {formatVietnameseDate(transaction.occurredAt)}</span>
              </div>
              <div className="transaction-amount">
                <strong>{formatVnd(transaction.amount)}</strong>
                <div className="action-chips">
                  <button type="button" onClick={() => onEdit(transaction)}><UiIcon name="pencil" size={14} /> Sửa</button>
                  <button className="delete-btn" type="button" onClick={() => onDelete(transaction)}><UiIcon name="trash" size={14} /> Xóa</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
