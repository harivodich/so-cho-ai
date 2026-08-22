import { z } from "zod";

import { productSchema, stockMovementSchema, type Product, type StockMovement } from "@/types/catalog";
import { counterpartySchema, type Counterparty } from "@/types/counterparty";
import { debtEntrySchema, type DebtEntry } from "@/types/debt";
import { confirmedTransactionSchema, type ConfirmedTransaction } from "@/types/transaction";

const MAX_BACKUP_ITEMS = 10_000;

const backupSchema = z.object({
  version: z.literal(2),
  exportedAt: z.string().datetime(),
  transactions: z.array(confirmedTransactionSchema).max(MAX_BACKUP_ITEMS, "Số lượng giao dịch vượt giới hạn sao lưu (10.000)."),
  debts: z.array(debtEntrySchema).max(MAX_BACKUP_ITEMS, "Số lượng công nợ vượt giới hạn sao lưu (10.000)."),
  products: z.array(productSchema).max(MAX_BACKUP_ITEMS, "Số lượng sản phẩm vượt giới hạn sao lưu (10.000)."),
  stockMovements: z.array(stockMovementSchema).max(MAX_BACKUP_ITEMS, "Số lượng biến động kho vượt giới hạn sao lưu (10.000)."),
  counterparties: z.array(counterpartySchema).max(MAX_BACKUP_ITEMS, "Số lượng đối tác vượt giới hạn sao lưu (10.000)."),
});

const legacyBackupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  transactions: z.array(confirmedTransactionSchema).max(MAX_BACKUP_ITEMS),
  debts: z.array(debtEntrySchema).max(MAX_BACKUP_ITEMS),
});

export type AppBackup = z.infer<typeof backupSchema>;

export function createBackup(
  transactions: ConfirmedTransaction[],
  debts: DebtEntry[],
  products: Product[] = [],
  stockMovements: StockMovement[] = [],
  counterparties: Counterparty[] = [],
): AppBackup {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions,
    debts,
    products,
    stockMovements,
    counterparties,
  };
}

export function reassignBackupOwner(backup: AppBackup, userId: string): AppBackup {
  const owner = userId.trim();
  if (!owner) throw new Error("Backup owner is required.");
  return {
    ...backup,
    transactions: backup.transactions.map((item) => ({ ...item, userId: owner })),
    debts: backup.debts.map((item) => ({ ...item, userId: owner })),
    products: backup.products.map((item) => ({ ...item, userId: owner })),
    stockMovements: backup.stockMovements.map((item) => ({ ...item, userId: owner })),
    counterparties: backup.counterparties.map((item) => ({ ...item, userId: owner })),
  };
}
export function parseBackup(value: unknown): AppBackup {
  const parsed = backupSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const legacy = legacyBackupSchema.safeParse(value);
  if (legacy.success) {
    return {
      ...legacy.data,
      version: 2,
      products: [],
      stockMovements: [],
      counterparties: [],
    };
  }
  throw new Error("Tệp backup không đúng định dạng hoặc có dữ liệu không hợp lệ.");
}

export function downloadBackup(backup: AppBackup, filename: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}