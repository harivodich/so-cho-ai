import { describe, expect, it } from "vitest";

import { calculateDailyReport, calculateMonthlyReport } from "../src/lib/reports";
import type { ConfirmedTransaction } from "../src/types/transaction";

function transaction(overrides: Partial<ConfirmedTransaction>): ConfirmedTransaction {
  return {
    id: "transaction-1",
    userId: "user-1",
    inputMethod: "manual",
    type: "sale",
    itemName: "Xoài",
    canonicalItemName: "xoài",
    quantity: 1,
    unit: "kg",
    unitPrice: 35_000,
    amount: 35_000,
    occurredAt: "2026-08-09",
    rawInput: "",
    fieldsNeedingReview: [],
    missingFields: [],
    warnings: [],
    confirmedAt: "2026-08-09T09:00:00.000Z",
    createdAt: "2026-08-09T09:00:00.000Z",
    updatedAt: "2026-08-09T09:00:00.000Z",
    ...overrides,
  };
}

describe("calculateDailyReport", () => {
  it("uses the latest purchase on or before a sale as estimated cost", () => {
    const report = calculateDailyReport(
      [
        transaction({ id: "old-purchase", type: "purchase", unitPrice: 22_000, amount: 660_000, occurredAt: "2026-08-07" }),
        transaction({ id: "latest-purchase", type: "purchase", unitPrice: 25_000, amount: 750_000, occurredAt: "2026-08-08" }),
        transaction({ id: "sale", type: "sale", quantity: 20, unitPrice: 35_000, amount: 700_000, occurredAt: "2026-08-09" }),
        transaction({ id: "expense", type: "expense", itemName: "Tiền đá", canonicalItemName: "tiền đá", quantity: null, unit: null, unitPrice: null, amount: 50_000, occurredAt: "2026-08-09" }),
      ],
      "2026-08-09",
    );

    expect(report.revenue).toBe(700_000);
    expect(report.estimatedCostOfGoods).toBe(500_000);
    expect(report.otherExpenses).toBe(50_000);
    expect(report.estimatedGrossProfit).toBe(150_000);
    expect(report.purchases).toBe(0);
  });

  it("does not report complete gross profit when a sale has no usable cost basis", () => {
    const report = calculateDailyReport(
      [transaction({ id: "sale", type: "sale", quantity: 10, amount: 350_000, occurredAt: "2026-08-09" })],
      "2026-08-09",
    );

    expect(report.estimatedGrossProfit).toBeNull();
    expect(report.uncostedSales).toHaveLength(1);
  });

  it("does not use a purchase made after the sale", () => {
    const report = calculateDailyReport(
      [
        transaction({ id: "sale", type: "sale", quantity: 10, amount: 350_000, occurredAt: "2026-08-09" }),
        transaction({ id: "future-purchase", type: "purchase", unitPrice: 25_000, amount: 500_000, occurredAt: "2026-08-10" }),
      ],
      "2026-08-09",
    );

    expect(report.estimatedGrossProfit).toBeNull();
  });
});

describe("calculateMonthlyReport", () => {
  it("summarizes the selected month, retains historical cost basis, and prepares chart data", () => {
    const report = calculateMonthlyReport(
      [
        transaction({ id: "july-sale", quantity: 10, amount: 200_000, occurredAt: "2026-07-20" }),
        transaction({ id: "july-purchase", type: "purchase", quantity: 20, unitPrice: 20_000, amount: 400_000, occurredAt: "2026-07-31" }),
        transaction({ id: "aug-sale-1", quantity: 10, unitPrice: 30_000, amount: 300_000, occurredAt: "2026-08-01" }),
        transaction({ id: "aug-sale-2", quantity: 5, unitPrice: 30_000, amount: 150_000, occurredAt: "2026-08-02" }),
        transaction({ id: "aug-expense", type: "expense", itemName: "Tiền đá", canonicalItemName: "tiền đá", quantity: null, unit: null, unitPrice: null, amount: 20_000, occurredAt: "2026-08-02" }),
        transaction({ id: "sep-sale", quantity: 5, amount: 180_000, occurredAt: "2026-09-01" }),
      ],
      "2026-08",
    );

    expect(report.revenue).toBe(450_000);
    expect(report.estimatedCostOfGoods).toBe(300_000);
    expect(report.otherExpenses).toBe(20_000);
    expect(report.estimatedGrossProfit).toBe(130_000);
    expect(report.previousMonthRevenue).toBe(200_000);
    expect(report.revenueChangePercent).toBe(125);
    expect(report.daysWithTransactions).toBe(2);
    expect(report.bestRevenueDay).toMatchObject({ date: "2026-08-01", revenue: 300_000 });
    expect(report.dailyRevenue).toHaveLength(31);
    expect(report.dailyRevenue[0]).toMatchObject({ date: "2026-08-01", revenue: 300_000 });
    expect(report.topItems[0]).toMatchObject({ itemName: "Xoài", revenue: 450_000, estimatedGrossProfit: 150_000 });
  });

  it("keeps monthly gross profit incomplete when one sale has no cost basis", () => {
    const report = calculateMonthlyReport(
      [transaction({ id: "sale", quantity: null, amount: 350_000, occurredAt: "2026-08-09" })],
      "2026-08",
    );

    expect(report.estimatedGrossProfit).toBeNull();
    expect(report.topItems[0]).toMatchObject({ missingCostSaleCount: 1, estimatedGrossProfit: null });
  });
});
