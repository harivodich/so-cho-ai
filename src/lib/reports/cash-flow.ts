import type { DebtEntry } from "@/types/debt";
import type { ConfirmedTransaction } from "@/types/transaction";

export type CashFlowSummary = {
  startDate: string;
  endDate: string;
  recognizedRevenue: number;
  recordedReceipts: number;
  recordedPayments: number;
  netRecordedCash: number;
};

function inRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Compare recognized sales with debt payments explicitly recorded in the period.
 * Debt entries are intentionally not treated as cash until a payment is recorded.
 */
export function calculateCashFlowSummary(
  transactions: ConfirmedTransaction[],
  debts: DebtEntry[],
  startDate: string,
  endDate: string,
): CashFlowSummary {
  const recognizedRevenue = transactions.reduce(
    (total, transaction) =>
      transaction.type === "sale" && inRange(transaction.occurredAt, startDate, endDate)
        ? total + transaction.amount
        : total,
    0,
  );
  const { recordedReceipts, recordedPayments } = debts.reduce(
    (summary, entry) => {
      for (const payment of entry.payments ?? []) {
        if (!inRange(payment.paidAt, startDate, endDate)) continue;
        if (entry.direction === "receivable") summary.recordedReceipts += payment.amount;
        else summary.recordedPayments += payment.amount;
      }
      return summary;
    },
    { recordedReceipts: 0, recordedPayments: 0 },
  );

  return {
    startDate,
    endDate,
    recognizedRevenue,
    recordedReceipts,
    recordedPayments,
    netRecordedCash: recordedReceipts - recordedPayments,
  };
}
