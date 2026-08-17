import { describe, expect, it } from "vitest";

import { calculateTaxEstimate, calculateTaxPeriodSummary } from "@/lib/reports/tax";
import type { PeriodReport } from "@/lib/reports";
import type { ConfirmedTransaction } from "@/types/transaction";
import { taxLineSchema } from "@/types/tax";

const report = { revenue: 10000000, estimatedGrossProfit: 3000000 } as PeriodReport;

describe("calculateTaxEstimate", () => {
  it("applies user-provided rates to the corresponding bases", () => {
    expect(calculateTaxEstimate(report, { revenueRatePercent: 1, incomeRatePercent: 2 })).toMatchObject({
      estimatedRevenueTax: 100000,
      estimatedIncomeTax: 60000,
      estimatedTotal: 160000,
    });
  });

  it("does not invent income tax when gross profit is incomplete", () => {
    expect(calculateTaxEstimate({ ...report, estimatedGrossProfit: null }, { revenueRatePercent: 1, incomeRatePercent: 2 })).toMatchObject({
      estimatedRevenueTax: 100000,
      estimatedIncomeTax: null,
      estimatedTotal: null,
    });
  });
  it("rejects tax lines whose amount or total does not match the formula", () => {
    expect(taxLineSchema.safeParse({ applied: true, subtotal: 100000, taxRatePercent: 2, taxAmount: 1, total: 100001 }).success).toBe(false);
    expect(taxLineSchema.safeParse({ applied: false, subtotal: 100000, taxRatePercent: 2, taxAmount: 0, total: 100000 }).success).toBe(false);
    expect(taxLineSchema.safeParse({ applied: true, subtotal: 100000, taxRatePercent: 2, taxAmount: 2000, total: 102000 }).success).toBe(true);
  });
  it("summarizes only applied tax lines in the selected period", () => {
    const transaction = { occurredAt: "2026-08-05", tax: { applied: true, subtotal: 100000, taxRatePercent: 2, taxAmount: 2000, total: 102000 } } as ConfirmedTransaction;
    expect(calculateTaxPeriodSummary([transaction], "2026-08-01", "2026-08-31")).toMatchObject({ subtotal: 100000, taxAmount: 2000, total: 102000, appliedTransactionCount: 1 });
  });
});
