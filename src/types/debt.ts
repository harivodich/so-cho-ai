import { z } from "zod";

export const debtDirections = ["receivable", "payable"] as const;
export const debtStatuses = ["open", "partial", "settled"] as const;

export type DebtDirection = (typeof debtDirections)[number];
export type DebtStatus = (typeof debtStatuses)[number];

export const debtPaymentSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  paidAt: z.string().date(),
  note: z.string().trim().max(500),
});

export type DebtPayment = z.infer<typeof debtPaymentSchema>;

export const debtEntrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  partyName: z.string().trim().min(1),
  direction: z.enum(debtDirections),
  amount: z.number().int().positive(),
  dueDate: z.string().date().nullable(),
  note: z.string().trim().max(500),
  status: z.enum(debtStatuses),
  paidAmount: z.number().int().nonnegative().optional(),
  payments: z.array(debtPaymentSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((entry, context) => {
  const paymentsTotal = (entry.payments ?? []).reduce((total, payment) => total + payment.amount, 0);
  if (paymentsTotal > entry.amount) {
    context.addIssue({ code: "custom", path: ["payments"], message: "Debt payments cannot exceed the original amount." });
  }
  if (entry.paidAmount !== undefined && entry.paidAmount > entry.amount) {
    context.addIssue({ code: "custom", path: ["paidAmount"], message: "Paid amount cannot exceed the original amount." });
  }
  if (entry.paidAmount !== undefined && entry.paidAmount < paymentsTotal) {
    context.addIssue({ code: "custom", path: ["paidAmount"], message: "Paid amount cannot be below the payment ledger total." });
  }
});

export type DebtEntry = z.infer<typeof debtEntrySchema>;

export type DebtSummary = {
  receivable: number;
  payable: number;
  openCount: number;
};

export type DebtLedgerSummary = DebtSummary & {
  outstanding: number;
  overdueCount: number;
};

export function debtPaidAmount(entry: DebtEntry): number {
  const paymentsTotal = (entry.payments ?? []).reduce((total, payment) => total + payment.amount, 0);
  return Math.min(entry.amount, Math.max(entry.paidAmount ?? paymentsTotal, paymentsTotal));
}

export function debtRemainingAmount(entry: DebtEntry): number {
  return Math.max(entry.amount - debtPaidAmount(entry), 0);
}

export function summarizeDebts(entries: DebtEntry[]): DebtSummary {
  return entries.reduce<DebtSummary>((summary, entry) => {
    if (entry.status === "settled") return summary;
    const remaining = debtRemainingAmount(entry);
    if (remaining === 0) return summary;
    summary[entry.direction] += remaining;
    summary.openCount += 1;
    return summary;
  }, { receivable: 0, payable: 0, openCount: 0 });
}

export function summarizeDebtLedger(entries: DebtEntry[], asOfDate: string): DebtLedgerSummary {
  return entries.reduce<DebtLedgerSummary>((result, entry) => {
    if (entry.status === "settled") return result;
    const remaining = debtRemainingAmount(entry);
    if (remaining === 0) return result;
    result[entry.direction] += remaining;
    result.outstanding += remaining;
    result.openCount += 1;
    if (entry.dueDate !== null && entry.dueDate < asOfDate) result.overdueCount += 1;
    return result;
  }, { receivable: 0, payable: 0, openCount: 0, outstanding: 0, overdueCount: 0 });
}