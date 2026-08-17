import { describe, expect, it } from "vitest";

import { calculateInventory } from "@/lib/reports/inventory";
import type { Product, StockMovement } from "@/types/catalog";
import type { ConfirmedTransaction } from "@/types/transaction";

function transaction(partial: Partial<ConfirmedTransaction>): ConfirmedTransaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    inputMethod: "manual",
    type: partial.type ?? "sale",
    itemName: partial.itemName ?? "Xoài",
    canonicalItemName: partial.canonicalItemName ?? "xoài",
    quantity: partial.quantity === undefined ? 0 : partial.quantity,
    unit: partial.unit ?? "kg",
    unitPrice: partial.unitPrice ?? 10000,
    amount: partial.amount ?? 10000,
    occurredAt: partial.occurredAt ?? "2026-08-05",
    rawInput: "",
    fieldsNeedingReview: [],
    missingFields: [],
    warnings: [],
    qualityChecks: [],
    confirmedAt: "2026-08-05T00:00:00.000Z",
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-05T00:00:00.000Z",
  };
}

describe("calculateInventory", () => {
  it("derives stock from purchases and sales up to the selected date", () => {
    const report = calculateInventory([
      transaction({ id: "p1", type: "purchase", quantity: 20, unitPrice: 50000, amount: 1000000, occurredAt: "2026-08-01" }),
      transaction({ id: "s1", type: "sale", quantity: 6, amount: 420000, occurredAt: "2026-08-03" }),
      transaction({ id: "s2", type: "sale", quantity: 4, amount: 280000, occurredAt: "2026-08-08" }),
      transaction({ id: "s3", type: "sale", quantity: 99, amount: 6930000, occurredAt: "2026-08-20" }),
    ], "2026-08-10");

    expect(report.rows[0]).toMatchObject({ purchasedQuantity: 20, soldQuantity: 10, stockQuantity: 10, estimatedStockValue: 500000 });
    expect(report.negativeStockCount).toBe(0);
  });

  it("does not double count transaction-backed stock movements", () => {
    const product: Product = {
      id: "product-xoai",
      userId: "u1",
      name: "XoÃ i",
      canonicalName: "xoÃ i",
      defaultUnit: "kg",
      lowStockThreshold: 0,
      active: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    const purchase = transaction({ itemName: "xoai", canonicalItemName: "xoai", id: "p1", type: "purchase", quantity: 20, unitPrice: 50000, amount: 1000000, occurredAt: "2026-08-01" });
    const sale = transaction({ itemName: "xoai", canonicalItemName: "xoai", id: "s1", type: "sale", quantity: 6, amount: 420000, occurredAt: "2026-08-03" });
    const movements: StockMovement[] = [
      { id: "transaction-stock:p1", userId: "u1", productId: product.id, itemName: product.name, canonicalItemName: product.canonicalName, unit: "kg", kind: "purchase", quantityDelta: 20, reason: "TÃ¹ giao dá»‹ch Ä‘Ã£ xÃ¡c nháº­n", sourceTransactionId: "p1", occurredAt: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z" },
      { id: "transaction-stock:s1", userId: "u1", productId: product.id, itemName: product.name, canonicalItemName: product.canonicalName, unit: "kg", kind: "sale", quantityDelta: -6, reason: "TÃ¹ giao dá»‹ch Ä‘Ã£ xÃ¡c nháº­n", sourceTransactionId: "s1", occurredAt: "2026-08-03", createdAt: "2026-08-03T00:00:00.000Z" },
    ];
    const report = calculateInventory([purchase, sale], "2026-08-10", [product], movements);
    expect(report.rows[0]).toMatchObject({ purchasedQuantity: 20, soldQuantity: 6, stockQuantity: 14, estimatedStockValue: 700000 });
  });
  it("flags missing quantities and negative estimated stock without blocking sales", () => {
    const report = calculateInventory([
      transaction({ id: "p1", type: "purchase", quantity: 2, occurredAt: "2026-08-01" }),
      transaction({ id: "s1", type: "sale", quantity: 5, occurredAt: "2026-08-02" }),
      transaction({ id: "s2", type: "sale", quantity: null, occurredAt: "2026-08-02" }),
    ], "2026-08-02");

    expect(report.rows[0].stockQuantity).toBe(-3);
    expect(report.negativeStockCount).toBe(1);
    expect(report.incompleteItemCount).toBe(1);
  });
});
