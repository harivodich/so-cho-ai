import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonthlyDashboard } from "../src/components/monthly-dashboard";
import { formatVnd } from "../src/lib/money";
import type { MonthlyReport } from "../src/lib/reports";

function report(overrides: Partial<MonthlyReport> = {}): MonthlyReport {
  return {
    month: "2026-08",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    revenue: 4_500_000,
    purchases: 9_999_000,
    otherExpenses: 350_000,
    estimatedCostOfGoods: 1_234_000,
    estimatedGrossProfit: 2_916_000,
    grossMarginPercent: 64.8,
    transactionCount: 8,
    saleCount: 3,
    averageSaleValue: 1_500_000,
    uncostedSales: [],
    costedSales: [],
    dailyRevenue: [
      { date: "2026-08-01", revenue: 1_500_000, transactionCount: 2 },
      { date: "2026-08-02", revenue: 3_000_000, transactionCount: 2 },
    ],
    daysWithTransactions: 2,
    bestRevenueDay: { date: "2026-08-02", revenue: 3_000_000, transactionCount: 2 },
    previousPeriodRevenue: 4_000_000,
    previousMonthRevenue: 4_000_000,
    revenueChangePercent: 12.5,
    topItems: [],
    ...overrides,
  };
}

describe("MonthlyDashboard", () => {
  it("renders estimated COGS in the second KPI instead of purchase spend", () => {
    const monthlyReport = report();

    const html = renderToStaticMarkup(
      createElement(MonthlyDashboard, { report: monthlyReport }),
    );

    expect(html).toContain("Giá vốn ước tính");
    expect(html).toContain(formatVnd(monthlyReport.estimatedCostOfGoods));
    expect(html).not.toContain(formatVnd(monthlyReport.purchases));
  });
});
