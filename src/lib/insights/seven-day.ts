import { addDays } from "@/lib/date";
import { calculateDailyReport, calculatePeriodReport } from "@/lib/reports";
import type { ConfirmedTransaction } from "@/types/transaction";

export type SevenDayEvidence = {
  startDate: string;
  endDate: string;
  todayRevenue: number;
  averageDailyRevenue: number;
  revenueDelta: number;
  revenueDeltaPercent: number | null;
  todaySaleCount: number;
  averageSaleValue: number;
  missingCostSaleCount: number;
  topItemName: string | null;
};

export function calculateSevenDayEvidence(transactions: ConfirmedTransaction[], date: string): SevenDayEvidence {
  const startDate = addDays(date, -6);
  const today = calculateDailyReport(transactions, date);
  const period = calculatePeriodReport(transactions, startDate, date);
  const averageDailyRevenue = Math.round(period.revenue / 7);
  const revenueDelta = today.revenue - averageDailyRevenue;
  return {
    startDate,
    endDate: date,
    todayRevenue: today.revenue,
    averageDailyRevenue,
    revenueDelta,
    revenueDeltaPercent: averageDailyRevenue > 0 ? (revenueDelta / averageDailyRevenue) * 100 : null,
    todaySaleCount: today.saleCount,
    averageSaleValue: today.averageSaleValue,
    missingCostSaleCount: period.uncostedSales.length,
    topItemName: period.topItems[0]?.itemName ?? null,
  };
}
