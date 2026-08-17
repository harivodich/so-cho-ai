import { z } from "zod";

export const taxLineSchema = z.object({
  applied: z.boolean(),
  subtotal: z.number().int().nonnegative(),
  taxRatePercent: z.number().finite().nonnegative().max(100),
  taxAmount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).superRefine((line, context) => {
  const expectedTaxAmount = line.applied ? Math.round(line.subtotal * line.taxRatePercent / 100) : 0;
  const expectedTotal = line.subtotal + expectedTaxAmount;
  if (!line.applied && line.taxRatePercent !== 0) {
    context.addIssue({ code: "custom", path: ["taxRatePercent"], message: "An unapplied tax line must use a zero rate." });
  }
  if (line.taxAmount !== expectedTaxAmount) {
    context.addIssue({ code: "custom", path: ["taxAmount"], message: "Tax amount does not match subtotal and rate." });
  }
  if (line.total !== expectedTotal) {
    context.addIssue({ code: "custom", path: ["total"], message: "Tax total does not match subtotal and tax amount." });
  }
});

export type TaxLine = z.infer<typeof taxLineSchema>;

export type TaxPeriodSummary = {
  startDate: string;
  endDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  appliedTransactionCount: number;
};
