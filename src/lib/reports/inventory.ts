import { canonicalizeItemName } from "@/types/transaction";
import type { ConfirmedTransaction } from "@/types/transaction";
import type { Product, StockMovement } from "@/types/catalog";

export type InventoryRow = {
  key: string;
  productId: string | null;
  itemName: string;
  unit: string | null;
  purchasedQuantity: number;
  soldQuantity: number;
  adjustmentQuantity: number;
  stockQuantity: number;
  latestPurchasePrice: number | null;
  latestPurchaseAt: string | null;
  hasMissingQuantity: boolean;
  lowStockThreshold: number | null;
  isLow: boolean;
  estimatedStockValue: number | null;
};

export type InventoryReport = {
  asOfDate: string;
  rows: InventoryRow[];
  incompleteItemCount: number;
  negativeStockCount: number;
  lowStockCount: number;
};

type MutableInventoryRow = Omit<InventoryRow, "estimatedStockValue" | "isLow">;

function rowFromProduct(product: Product): MutableInventoryRow {
  return {
    key: product.id,
    productId: product.id,
    itemName: product.name,
    unit: product.defaultUnit,
    purchasedQuantity: 0,
    soldQuantity: 0,
    adjustmentQuantity: 0,
    stockQuantity: 0,
    latestPurchasePrice: null,
    latestPurchaseAt: null,
    hasMissingQuantity: false,
    lowStockThreshold: product.lowStockThreshold,
  };
}

export function calculateInventory(
  transactions: ConfirmedTransaction[],
  asOfDate: string,
  products: Product[] = [],
  movements: StockMovement[] = [],
): InventoryReport {
  const rows = new Map<string, MutableInventoryRow>();
  const productsByCanonical = new Map(products.map((product) => [product.canonicalName, product]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const appliedTransactionIds = new Set<string>();

  for (const product of products) rows.set(product.id, rowFromProduct(product));

  for (const movement of movements) {
    if (movement.occurredAt > asOfDate) continue;
    const product = productsById.get(movement.productId);
    if (!product) continue;
    const current = rows.get(product.id) ?? rowFromProduct(product);
    current.stockQuantity += movement.quantityDelta;
    if (movement.kind === "purchase") {
      current.purchasedQuantity += Math.max(movement.quantityDelta, 0);
      const sourceTransaction = movement.sourceTransactionId ? transactionsById.get(movement.sourceTransactionId) : undefined;
      if (sourceTransaction && sourceTransaction.occurredAt <= asOfDate) {
        appliedTransactionIds.add(sourceTransaction.id);
        if (current.latestPurchaseAt === null || sourceTransaction.occurredAt > current.latestPurchaseAt) {
          current.latestPurchaseAt = sourceTransaction.occurredAt;
          current.latestPurchasePrice = sourceTransaction.unitPrice;
        }
      }
    } else if (movement.kind === "sale") {
      current.soldQuantity += Math.max(-movement.quantityDelta, 0);
      if (movement.sourceTransactionId && transactionsById.has(movement.sourceTransactionId)) {
        appliedTransactionIds.add(movement.sourceTransactionId);
      }
    } else {
      current.adjustmentQuantity += movement.quantityDelta;
    }
    rows.set(product.id, current);
  }

  for (const transaction of transactions) {
    if (appliedTransactionIds.has(transaction.id)) continue;
    if (transaction.occurredAt > asOfDate || (transaction.type !== "sale" && transaction.type !== "purchase")) continue;
    const itemName = transaction.itemName?.trim();
    if (!itemName) continue;
    const canonicalName = transaction.canonicalItemName ?? canonicalizeItemName(itemName) ?? itemName.toLocaleLowerCase("vi-VN");
    const product = productsByCanonical.get(canonicalName);
    const key = product?.id ?? canonicalName;
    const current = rows.get(key) ?? {
      key,
      productId: product?.id ?? null,
      itemName: product?.name ?? itemName,
      unit: product?.defaultUnit ?? transaction.unit,
      purchasedQuantity: 0,
      soldQuantity: 0,
      adjustmentQuantity: 0,
      stockQuantity: 0,
      latestPurchasePrice: null,
      latestPurchaseAt: null,
      hasMissingQuantity: false,
      lowStockThreshold: product?.lowStockThreshold ?? null,
    };

    if (transaction.unit && !current.unit) current.unit = transaction.unit;
    if (transaction.quantity === null) {
      current.hasMissingQuantity = true;
    } else if (transaction.type === "purchase") {
      current.purchasedQuantity += transaction.quantity;
      current.stockQuantity += transaction.quantity;
      if (current.latestPurchaseAt === null || transaction.occurredAt > current.latestPurchaseAt) {
        current.latestPurchaseAt = transaction.occurredAt;
        current.latestPurchasePrice = transaction.unitPrice;
      }
    } else {
      current.soldQuantity += transaction.quantity;
      current.stockQuantity -= transaction.quantity;
    }
    rows.set(key, current);
  }

  const orderedRows = [...rows.values()]
    .map((row) => ({
      ...row,
      isLow: row.lowStockThreshold !== null && row.stockQuantity <= row.lowStockThreshold,
      estimatedStockValue: row.latestPurchasePrice === null ? null : Math.max(row.stockQuantity, 0) * row.latestPurchasePrice,
    }))
    .sort((left, right) => left.itemName.localeCompare(right.itemName, "vi-VN"));

  return {
    asOfDate,
    rows: orderedRows,
    incompleteItemCount: orderedRows.filter((row) => row.hasMissingQuantity).length,
    negativeStockCount: orderedRows.filter((row) => row.stockQuantity < 0).length,
    lowStockCount: orderedRows.filter((row) => row.isLow).length,
  };
}