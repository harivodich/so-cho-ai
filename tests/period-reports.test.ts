import { describe, expect, it } from "vitest";

import {
  addDays,
  dateRange,
  daysInclusive,
  previousDateRange,
} from "../src/lib/date";
import { calculatePeriodReport } from "../src/lib/reports";
import type { ConfirmedTransaction } from "../src/types/transaction";

function transaction(overrides: Partial<ConfirmedTransaction>): ConfirmedTransaction {
  return {
    id: "transaction-1",
    userId: "user-1",
    inputMethod: "manual",
    type: "sale",
    itemName: "Cam",
    canonicalItemName: "cam",
    quantity: 1,
    unit: "kg",
    unitPrice: 40_000,
    amount: 40_000,
    occurredAt: "2026-08-12",
    rawInput: "",
    fieldsNeedingReview: [],
    missingFields: [],
    warnings: [],
    confirmedAt: "2026-08-12T09:00:00.000Z",
    createdAt: "2026-08-12T09:00:00.000Z",
    updatedAt: "2026-08-12T09:00:00.000Z",
    ...overrides,
  };
}

describe("date ranges", () => {
  it("builds inclusive ranges across leap day and derives an equal previous period", () => {
    expect(dateRange("2028-02-28", "2028-03-01")).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
    expect(daysInclusive("2028-02-28", "2028-03-01")).toBe(3);
    expect(previousDateRange("2028-02-28", "2028-03-01")).toEqual({
      startDate: "2028-02-25",
      endDate: "2028-02-27",
    });
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("rejects invalid and overly long chart ranges", () => {
    expect(dateRange("2026-08-12", "2026-08-01")).toEqual([]);
    expect(dateRange("2025-01-01", "2026-12-31")).toEqual([]);
  });
});

describe("calculatePeriodReport", () => {
  const transactions = [
    transaction({ id: "previous-sale", amount: 100_000, occurredAt: "2026-08-05" }),
    transaction({ id: "cam-purchase", type: "purchase", quantity: 20, unitPrice: 20_000, amount: 400_000, occurredAt: "2026-08-01" }),
    transaction({ id: "cam-sale-1", quantity: 2, amount: 100_000, occurredAt: "2026-08-06" }),
    transaction({ id: "cam-sale-2", quantity: 3, amount: 150_000, occurredAt: "2026-08-10" }),
    transaction({ id: "banana-sale", itemName: "Chuối", canonicalItemName: "chuối", quantity: null, amount: 80_000, occurredAt: "2026-08-11" }),
    transaction({ id: "expense", type: "expense", itemName: "Túi", canonicalItemName: "túi", quantity: null, unit: null, unitPrice: null, amount: 20_000, occurredAt: "2026-08-12" }),
  ];

  it("summarizes seven days and compares the equal previous period", () => {
    const report = calculatePeriodReport(transactions, "2026-08-06", "2026-08-12");

    expect(report.dailyRevenue).toHaveLength(7);
    expect(report.revenue).toBe(330_000);
    expect(report.previousPeriodRevenue).toBe(100_000);
    expect(report.revenueChangePercent).toBeCloseTo(230);
    expect(report.saleCount).toBe(3);
    expect(report.averageSaleValue).toBe(110_000);
    expect(report.estimatedGrossProfit).toBeNull();
    expect(report.uncostedSales).toHaveLength(1);
  });

  it("filters the dashboard without losing historical purchase cost basis", () => {
    const report = calculatePeriodReport(
      transactions,
      "2026-08-06",
      "2026-08-12",
      { itemKey: "cam", transactionType: "sale" },
    );

    expect(report.revenue).toBe(250_000);
    expect(report.estimatedCostOfGoods).toBe(100_000);
    expect(report.estimatedGrossProfit).toBe(150_000);
    expect(report.transactionCount).toBe(2);
    expect(report.topItems).toHaveLength(1);
    expect(report.topItems[0].itemName).toBe("Cam");
  });

  it("keeps expense-only reports truthful", () => {
    const report = calculatePeriodReport(
      transactions,
      "2026-08-06",
      "2026-08-12",
      { transactionType: "expense" },
    );

    expect(report.revenue).toBe(0);
    expect(report.otherExpenses).toBe(20_000);
    expect(report.saleCount).toBe(0);
    expect(report.averageSaleValue).toBe(0);
    expect(report.transactionCount).toBe(1);
  });
});
