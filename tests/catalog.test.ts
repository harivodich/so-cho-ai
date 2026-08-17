import { describe, expect, it } from "vitest";

import { calculateInventory } from "@/lib/reports/inventory";
import type { Product, StockMovement } from "@/types/catalog";

const product: Product = {
  id: "p1",
  userId: "u1",
  name: "Xoai",
  canonicalName: "xoai",
  defaultUnit: "kg",
  lowStockThreshold: 5,
  active: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const adjustment: StockMovement = {
  id: "m1",
  userId: "u1",
  productId: "p1",
  itemName: "Xoai",
  canonicalItemName: "xoai",
  unit: "kg",
  kind: "adjustment",
  quantityDelta: -3,
  reason: "Kiem ke",
  sourceTransactionId: null,
  occurredAt: "2026-08-02",
  createdAt: "2026-08-02T00:00:00.000Z",
};

describe("product catalog inventory", () => {
  it("applies manual adjustments and computes low-stock state", () => {
    const report = calculateInventory([], "2026-08-03", [product], [adjustment]);
    expect(report.rows[0]).toMatchObject({ stockQuantity: -3, adjustmentQuantity: -3, isLow: true });
    expect(report.negativeStockCount).toBe(1);
    expect(report.lowStockCount).toBe(1);
  });
});
