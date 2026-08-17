import type { Product, StockMovement } from "@/types/catalog";
import type { ConfirmedTransaction } from "@/types/transaction";
import { canonicalizeItemName } from "@/types/transaction";

export function transactionStockMovementId(transactionId: string): string {
  return "transaction-stock:" + transactionId;
}

export function buildTransactionStockMovement(transaction: ConfirmedTransaction, product: Product): StockMovement | null {
  if ((transaction.type !== "sale" && transaction.type !== "purchase") || transaction.quantity === null || transaction.quantity <= 0 || !transaction.itemName || !transaction.unit) return null;
  const canonicalName = canonicalizeItemName(transaction.canonicalItemName ?? transaction.itemName);
  if (!canonicalName || canonicalName !== product.canonicalName) return null;
  if (product.defaultUnit.trim().toLowerCase() !== transaction.unit.trim().toLowerCase()) return null;
  return {
    id: transactionStockMovementId(transaction.id),
    userId: product.userId,
    productId: product.id,
    itemName: product.name,
    canonicalItemName: product.canonicalName,
    unit: transaction.unit,
    kind: transaction.type,
    quantityDelta: transaction.type === "sale" ? -transaction.quantity : transaction.quantity,
    reason: "Tự động từ giao dịch đã xác nhận",
    sourceTransactionId: transaction.id,
    occurredAt: transaction.occurredAt,
    createdAt: transaction.createdAt,
  };
}

export function stockMovementMatches(left: StockMovement, right: StockMovement): boolean {
  return left.id === right.id
    && left.userId === right.userId
    && left.productId === right.productId
    && left.canonicalItemName === right.canonicalItemName
    && left.unit === right.unit
    && left.kind === right.kind
    && left.quantityDelta === right.quantityDelta
    && left.sourceTransactionId === right.sourceTransactionId
    && left.occurredAt === right.occurredAt;
}