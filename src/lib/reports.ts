import type { ConfirmedTransaction } from "@/types/transaction";

export type CostedSale = {
  saleId: string;
  cost: number | null;
  purchaseId: string | null;
};

export type DailyReport = {
  date: string;
  revenue: number;
  purchases: number;
  otherExpenses: number;
  estimatedCostOfGoods: number;
  estimatedGrossProfit: number | null;
  transactionCount: number;
  uncostedSales: ConfirmedTransaction[];
  costedSales: CostedSale[];
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

export function calculateDailyReport(
  transactions: ConfirmedTransaction[],
  date: string,
): DailyReport {
  const dayTransactions = transactions.filter((transaction) => transaction.occurredAt === date);
  const sales = dayTransactions.filter((transaction) => transaction.type === "sale");
  const purchases = dayTransactions.filter((transaction) => transaction.type === "purchase");
  const expenses = dayTransactions.filter((transaction) => transaction.type === "expense");

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

  return {
    date,
    revenue,
    purchases: purchases.reduce((total, transaction) => total + transaction.amount, 0),
    otherExpenses,
    estimatedCostOfGoods,
    estimatedGrossProfit:
      uncostedSales.length === 0 ? revenue - estimatedCostOfGoods - otherExpenses : null,
    transactionCount: dayTransactions.length,
    uncostedSales,
    costedSales,
  };
}
