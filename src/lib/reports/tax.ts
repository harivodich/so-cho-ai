import type { PeriodReport } from "@/lib/reports";

export type TaxRates = {
  revenueRatePercent: number;
  incomeRatePercent: number;
};

export type TaxEstimate = {
  revenueBase: number;
  estimatedRevenueTax: number;
  incomeBase: number | null;
  estimatedIncomeTax: number | null;
  estimatedTotal: number | null;
};

export function calculateTaxEstimate(report: PeriodReport, rates: TaxRates): TaxEstimate {
  const revenueRate = Math.max(0, rates.revenueRatePercent) / 100;
  const incomeRate = Math.max(0, rates.incomeRatePercent) / 100;
  const estimatedRevenueTax = Math.round(report.revenue * revenueRate);
  const incomeBase = report.estimatedGrossProfit === null ? null : Math.max(report.estimatedGrossProfit, 0);
  const estimatedIncomeTax = incomeBase === null ? null : Math.round(incomeBase * incomeRate);

  return {
    revenueBase: report.revenue,
    estimatedRevenueTax,
    incomeBase,
    estimatedIncomeTax,
    estimatedTotal: estimatedIncomeTax === null ? null : estimatedRevenueTax + estimatedIncomeTax,
  };
}

export function calculateTaxPeriodSummary(
  transactions: import("@/types/transaction").ConfirmedTransaction[],
  startDate: string,
  endDate: string,
): import("@/types/tax").TaxPeriodSummary {
  return transactions.reduce<import("@/types/tax").TaxPeriodSummary>((summary, transaction) => {
    if (transaction.occurredAt < startDate || transaction.occurredAt > endDate || !transaction.tax?.applied) return summary;
    summary.subtotal += transaction.tax.subtotal;
    summary.taxAmount += transaction.tax.taxAmount;
    summary.total += transaction.tax.total;
    summary.appliedTransactionCount += 1;
    return summary;
  }, { startDate, endDate, subtotal: 0, taxAmount: 0, total: 0, appliedTransactionCount: 0 });
}