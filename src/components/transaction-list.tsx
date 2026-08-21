"use client";

import { useMemo, useState } from "react";

import { UiIcon, type IconName } from "@/components/ui-icon";
import { formatVietnameseDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { triggerHapticFeedback } from "@/lib/haptic";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return transactions.filter((transaction) => {
      // Type filter
      if (filter !== "all" && transaction.type !== filter) {
        return false;
      }
      // Date filter
      if (selectedDate && transaction.occurredAt !== selectedDate) {
        return false;
      }
      // Search query filter (matches item name, unit, amount, or raw input)
      if (query) {
        const nameMatch = transaction.itemName?.toLowerCase().includes(query) ?? false;
        const canonicalMatch = transaction.canonicalItemName?.toLowerCase().includes(query) ?? false;
        const amountMatch = String(transaction.amount).includes(query);
        const dateMatch = transaction.occurredAt.includes(query);
        const typeMatch = labels[transaction.type].toLowerCase().includes(query);
        if (!nameMatch && !canonicalMatch && !amountMatch && !dateMatch && !typeMatch) {
          return false;
        }
      }
      return true;
    });
  }, [filter, searchQuery, selectedDate, transactions]);

  const hasActiveFilters = filter !== "all" || searchQuery.trim() !== "" || selectedDate !== "";

  function clearAllFilters() {
    triggerHapticFeedback(15);
    setSearchQuery("");
    setSelectedDate("");
    onFilterChange("all");
  }

  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="section-heading ledger-heading">
        <div>
          <h2 id="ledger-title">Sổ giao dịch</h2>
          <p className="section-description">
            Chỉ hiện các giao dịch bạn đã xác nhận lưu ({filteredTransactions.length}
            {transactions.length !== filteredTransactions.length ? `/${transactions.length}` : ""} giao dịch).
          </p>
        </div>
      </div>

      {/* Search and Quick Date Bar */}
      <div className="ledger-search-bar">
        <div className="search-input-wrapper">
          <UiIcon name="book" size={17} />
          <input
            type="search"
            className="ledger-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hàng, số tiền (VD: Xoài, 50000)..."
            aria-label="Tìm kiếm giao dịch"
          />
          {searchQuery ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          ) : null}
        </div>
        <input
          type="date"
          className="ledger-date-filter"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          title="Lọc theo ngày cụ thể"
        />
        {selectedDate ? (
          <button
            type="button"
            className="date-clear-btn"
            onClick={() => setSelectedDate("")}
            title="Xóa lọc ngày"
          >
            Tất cả ngày
          </button>
        ) : null}
      </div>

      {/* Type Filter Buttons */}
      <div className="filter-row" aria-label="Lọc loại giao dịch">
        {(["all", "sale", "purchase", "expense"] as const).map((value) => (
          <button
            aria-pressed={filter === value}
            className={filter === value ? "filter-button selected" : "filter-button"}
            key={value}
            type="button"
            onClick={() => {
              triggerHapticFeedback(15);
              onFilterChange(value);
            }}
          >
            {value === "all" ? "Tất cả" : labels[value]}
          </button>
        ))}
        {hasActiveFilters ? (
          <button
            type="button"
            className="filter-reset-link"
            onClick={clearAllFilters}
          >
            Đặt lại bộ lọc
          </button>
        ) : null}
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon"><UiIcon name="book" size={24} /></span>
          <p>Chưa có giao dịch phù hợp</p>
          <span>
            {hasActiveFilters
              ? "Không tìm thấy giao dịch nào khớp với bộ lọc hiện tại."
              : "Giao dịch sẽ xuất hiện ở đây sau khi bạn xác nhận lưu."}
          </span>
          {hasActiveFilters ? (
            <button className="secondary-button" type="button" onClick={clearAllFilters} style={{ marginTop: "0.75rem" }}>
              Xóa bộ lọc để xem tất cả
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="transaction-list">
          {filteredTransactions.map((transaction) => (
            <li key={transaction.id}>
              <div className={`transaction-marker ${transaction.type}`}>
                <UiIcon name={icons[transaction.type]} size={19} />
              </div>
              <div className="transaction-main">
                <strong>{transaction.itemName ?? labels[transaction.type]}</strong>
                <span>
                  {labels[transaction.type]}
                  {transaction.quantity && transaction.unit ? ` · ${transaction.quantity} ${transaction.unit}` : ""}
                  {" · "}
                  {formatVietnameseDate(transaction.occurredAt)}
                </span>
              </div>
              <div className="transaction-amount">
                <strong>{formatVnd(transaction.amount)}</strong>
                <div className="action-chips">
                  <button type="button" onClick={() => onEdit(transaction)}>
                    <UiIcon name="pencil" size={14} /> Sửa
                  </button>
                  <button className="delete-btn" type="button" onClick={() => onDelete(transaction)}>
                    <UiIcon name="trash" size={14} /> Xóa
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
