import { dateRange, monthRange, previousDateRange } from "@/lib/date";
import type { ConfirmedTransaction, TransactionType } from "@/types/transaction";

export type CostedSale = {
  saleId: string;
  cost: number | null;
  purchaseId: string | null;
};

export type ReportFilters = {
  transactionType?: "all" | TransactionType;
  itemKey?: "all" | string;
};

type ReportSummary = {
  revenue: number;
  purchases: number;
  otherExpenses: number;
  estimatedCostOfGoods: number;
  estimatedGrossProfit: number | null;
  grossMarginPercent: number | null;
  transactionCount: number;
  saleCount: number;
  averageSaleValue: number;
  uncostedSales: ConfirmedTransaction[];
  costedSales: CostedSale[];
};

export type DailyReport = ReportSummary & {
  date: string;
};

export type DailyRevenue = {
  date: string;
  revenue: number;
  transactionCount: number;
};

export type MonthlyItemPerformance = {
  itemName: string;
  revenue: number;
  saleCount: number;
  estimatedGrossProfit: number | null;
  missingCostSaleCount: number;
};

export type PeriodReport = ReportSummary & {
  startDate: string;
  endDate: string;
  dailyRevenue: DailyRevenue[];
  daysWithTransactions: number;
  bestRevenueDay: DailyRevenue | null;
  previousPeriodRevenue: number;
  revenueChangePercent: number | null;
  topItems: MonthlyItemPerformance[];
};

export type MonthlyReport = PeriodReport & {
  month: string;
  previousMonthRevenue: number;
};

function onOrBefore(left: string, right: string): boolean {
  return left <= right;
}

function latestMatchingPurchase(
  sale: ConfirmedTransaction,
  transactions: ConfirmedTransaction[],
): ConfirmedTransaction | undefined {
  if (!sale.canonicalItemName || !sale.quantity) {
    return undefined;
  }

  return transactions
    .filter(
      (transaction) =>
        transaction.type === "purchase" &&
        transaction.canonicalItemName === sale.canonicalItemName &&
        transaction.unitPrice !== null &&
        onOrBefore(transaction.occurredAt, sale.occurredAt),
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
}

function summarizeTransactions(
  transactions: ConfirmedTransaction[],
  periodTransactions: ConfirmedTransaction[],
): ReportSummary {
  const sales = periodTransactions.filter((transaction) => transaction.type === "sale");
  const purchases = periodTransactions.filter((transaction) => transaction.type === "purchase");
  const expenses = periodTransactions.filter((transaction) => transaction.type === "expense");
  const costedSales = sales.map((sale) => {
    const purchase = latestMatchingPurchase(sale, transactions);
    const cost = purchase?.unitPrice && sale.quantity ? purchase.unitPrice * sale.quantity : null;

    return {
      saleId: sale.id,
      cost,
      purchaseId: purchase?.id ?? null,
    };
  });
  const uncostedSales = sales.filter((sale) =>
    costedSales.some((costedSale) => costedSale.saleId === sale.id && costedSale.cost === null),
  );
  const estimatedCostOfGoods = costedSales.reduce(
    (total, costedSale) => total + (costedSale.cost ?? 0),
    0,
  );
  const revenue = sales.reduce((total, transaction) => total + transaction.amount, 0);
  const otherExpenses = expenses.reduce((total, transaction) => total + transaction.amount, 0);
  const estimatedGrossProfit =
    uncostedSales.length === 0 ? revenue - estimatedCostOfGoods - otherExpenses : null;

  return {
    revenue,
    purchases: purchases.reduce((total, transaction) => total + transaction.amount, 0),
    otherExpenses,
    estimatedCostOfGoods,
    estimatedGrossProfit,
    grossMarginPercent:
      estimatedGrossProfit !== null && revenue > 0 ? (estimatedGrossProfit / revenue) * 100 : null,
    transactionCount: periodTransactions.length,
    saleCount: sales.length,
    averageSaleValue: sales.length > 0 ? Math.round(revenue / sales.length) : 0,
    uncostedSales,
    costedSales,
  };
}

export function transactionItemKey(transaction: ConfirmedTransaction): string {
  return transaction.canonicalItemName ?? transaction.itemName?.trim().toLocaleLowerCase("vi-VN") ?? transaction.id;
}

function matchesFilters(transaction: ConfirmedTransaction, filters: ReportFilters): boolean {
  const typeMatches = !filters.transactionType || filters.transactionType === "all" || transaction.type === filters.transactionType;
  const itemMatches = !filters.itemKey || filters.itemKey === "all" || transactionItemKey(transaction) === filters.itemKey;
  return typeMatches && itemMatches;
}

function calculateTopItems(
  sales: ConfirmedTransaction[],
  costedSales: CostedSale[],
): MonthlyItemPerformance[] {
  const costs = new Map(costedSales.map((costedSale) => [costedSale.saleId, costedSale.cost]));
  const groups = new Map<string, MonthlyItemPerformance & { estimatedCosts: number }>();

  for (const sale of sales) {
    const key = transactionItemKey(sale);
    const cost = costs.get(sale.id) ?? null;
    const existing = groups.get(key) ?? {
      itemName: sale.itemName ?? "Chưa ghi tên mặt hàng",
      revenue: 0,
      saleCount: 0,
      estimatedGrossProfit: null,
      missingCostSaleCount: 0,
      estimatedCosts: 0,
    };

    existing.revenue += sale.amount;
    existing.saleCount += 1;
    existing.estimatedCosts += cost ?? 0;
    existing.missingCostSaleCount += cost === null ? 1 : 0;
    groups.set(key, existing);
  }

  return [...groups.values()]
    .map(({ estimatedCosts, ...item }) => ({
      ...item,
      estimatedGrossProfit:
        item.missingCostSaleCount === 0 ? item.revenue - estimatedCosts : null,
    }))
    .sort((left, right) => right.revenue - left.revenue || right.saleCount - left.saleCount)
    .slice(0, 5);
}

function transactionsInRange(
  transactions: ConfirmedTransaction[],
  startDate: string,
  endDate: string,
  filters: ReportFilters,
): ConfirmedTransaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.occurredAt >= startDate &&
      transaction.occurredAt <= endDate &&
      matchesFilters(transaction, filters),
  );
}

export function calculateDailyReport(
  transactions: ConfirmedTransaction[],
  date: string,
  filters: ReportFilters = {},
): DailyReport {
  const dayTransactions = transactionsInRange(transactions, date, date, filters);
  return {
    date,
    ...summarizeTransactions(transactions, dayTransactions),
  };
}

export function calculatePeriodReport(
  transactions: ConfirmedTransaction[],
  startDate: string,
  endDate: string,
  filters: ReportFilters = {},
): PeriodReport {
  const dates = dateRange(startDate, endDate);
  const periodTransactions = dates.length > 0
    ? transactionsInRange(transactions, startDate, endDate, filters)
    : [];
  const summary = summarizeTransactions(transactions, periodTransactions);
  const sales = periodTransactions.filter((transaction) => transaction.type === "sale");
  const dailyRevenue = dates.map((date) => {
    const dailyTransactions = periodTransactions.filter((transaction) => transaction.occurredAt === date);
    return {
      date,
      revenue: dailyTransactions
        .filter((transaction) => transaction.type === "sale")
        .reduce((total, transaction) => total + transaction.amount, 0),
      transactionCount: dailyTransactions.length,
    };
  });
  const bestRevenueDay = dailyRevenue.reduce<DailyRevenue | null>(
    (best, day) => (!best || day.revenue > best.revenue ? day : best),
    null,
  );
  const previousRange = previousDateRange(startDate, endDate);
  const previousPeriodRevenue = previousRange
    ? transactionsInRange(transactions, previousRange.startDate, previousRange.endDate, filters)
      .filter((transaction) => transaction.type === "sale")
      .reduce((total, transaction) => total + transaction.amount, 0)
    : 0;

  return {
    startDate,
    endDate,
    ...summary,
    dailyRevenue,
    daysWithTransactions: dailyRevenue.filter((day) => day.transactionCount > 0).length,
    bestRevenueDay: bestRevenueDay?.revenue ? bestRevenueDay : null,
    previousPeriodRevenue,
    revenueChangePercent:
      previousPeriodRevenue > 0 ? ((summary.revenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 : null,
    topItems: calculateTopItems(sales, summary.costedSales),
  };
}

export function calculateMonthlyReport(
  transactions: ConfirmedTransaction[],
  month: string,
  filters: ReportFilters = {},
): MonthlyReport {
  const range = monthRange(month);
  const periodReport = range
    ? calculatePeriodReport(transactions, range.startDate, range.endDate, filters)
    : calculatePeriodReport(transactions, "", "", filters);

  return {
    month,
    ...periodReport,
    previousMonthRevenue: periodReport.previousPeriodRevenue,
  };
}
