import { transactionItemKey, type ReportFilters } from "@/lib/reports";
import type { ConfirmedTransaction } from "@/types/transaction";

const CSV_DELIMITER = ";";

const TYPE_LABELS: Record<ConfirmedTransaction["type"], string> = {
  sale: "Bán",
  purchase: "Nhập",
  expense: "Chi phí",
};

function safeCsvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function transactionsForExport(
  transactions: ConfirmedTransaction[],
  startDate: string,
  endDate: string,
  filters: ReportFilters = {},
): ConfirmedTransaction[] {
  return transactions
    .filter((transaction) => {
      const date = transaction.occurredAt.slice(0, 10);
      const matchesType = !filters.transactionType || filters.transactionType === "all" || transaction.type === filters.transactionType;
      const matchesItem = !filters.itemKey || filters.itemKey === "all" || transactionItemKey(transaction) === filters.itemKey;
      return date >= startDate && date <= endDate && matchesType && matchesItem;
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
}

/**
 * Excel on Vietnamese Windows uses semicolon as the default list separator.
 * Quoting every field preserves commas/semicolons inside item names while the
 * UTF-8 BOM makes Vietnamese text open correctly in Excel.
 */
export function serializeTransactionsCsv(transactions: ConfirmedTransaction[]): string {
  const header = ["Ngày", "Loại", "Mặt hàng", "Số lượng", "Đơn vị", "Đơn giá (VND)", "Tổng tiền (VND)", "Cách nhập"];
  const rows = transactions.map((transaction) => [
    transaction.occurredAt.slice(0, 10),
    TYPE_LABELS[transaction.type],
    transaction.itemName,
    transaction.quantity,
    transaction.unit,
    transaction.unitPrice,
    transaction.amount,
    transaction.inputMethod,
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(safeCsvCell).join(CSV_DELIMITER)).join("\r\n")}\r\n`;
}

export function downloadTransactionsCsv(transactions: ConfirmedTransaction[], filename: string) {
  const blob = new Blob([serializeTransactionsCsv(transactions)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.replace(/[^a-z0-9._-]/giu, "-");
  anchor.click();
  URL.revokeObjectURL(url);
}
