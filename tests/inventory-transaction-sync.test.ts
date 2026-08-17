import { describe, expect, it } from "vitest";

import { buildTransactionStockMovement, stockMovementMatches, transactionStockMovementId } from "@/lib/catalog/transaction-stock";
import type { ConfirmedTransaction } from "@/types/transaction";
import type { Product } from "@/types/catalog";

const product: Product = {
  id: "product-xoai",
  userId: "uid-a",
  name: "Xoài",
  canonicalName: "xoai",
  defaultUnit: "kg",
  lowStockThreshold: 2,
  active: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function transaction(partial: Partial<ConfirmedTransaction>): ConfirmedTransaction {
  return {
    id: "tx-1",
    userId: "uid-a",
    inputMethod: "manual",
    type: "sale",
    itemName: "Xoài",
    canonicalItemName: "xoai",
    quantity: 3,
    unit: "kg",
    unitPrice: 40000,
    amount: 120000,
    occurredAt: "2026-08-10",
    rawInput: "",
    fieldsNeedingReview: [],
    missingFields: [],
    warnings: [],
    qualityChecks: [],
    confirmedAt: "2026-08-10T00:00:00.000Z",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...partial,
  };
}

describe("transaction to stock movement", () => {
  it("decreases stock for a confirmed sale and uses a deterministic id", () => {
    const movement = buildTransactionStockMovement(transaction({}), product);
    expect(movement).toMatchObject({
      id: "transaction-stock:tx-1",
      kind: "sale",
      quantityDelta: -3,
      sourceTransactionId: "tx-1",
      productId: product.id,
    });
    expect(transactionStockMovementId("tx-1")).toBe("transaction-stock:tx-1");
  });

  it("increases stock for purchase and refuses unit conversion", () => {
    expect(buildTransactionStockMovement(transaction({ type: "purchase", quantity: 5 }), product)).toMatchObject({ quantityDelta: 5, kind: "purchase" });
    expect(buildTransactionStockMovement(transaction({ unit: "thùng" }), product)).toBeNull();
  });

  it("does not create movement for expenses or incomplete quantity", () => {
    expect(buildTransactionStockMovement(transaction({ type: "expense" }), product)).toBeNull();
    expect(buildTransactionStockMovement(transaction({ quantity: null }), product)).toBeNull();
  });

  it("recognizes an idempotent retry of the same transaction", () => {
    const first = buildTransactionStockMovement(transaction({}), product)!;
    const retry = buildTransactionStockMovement(transaction({}), product)!;
    expect(stockMovementMatches(first, retry)).toBe(true);
    expect(stockMovementMatches(first, { ...retry, quantityDelta: -4 })).toBe(false);
  });
});