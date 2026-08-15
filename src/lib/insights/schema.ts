import { z } from "zod";

const sevenDayEvidenceSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  todayRevenue: z.number().int().nonnegative(),
  averageDailyRevenue: z.number().int().nonnegative(),
  revenueDelta: z.number().int(),
  revenueDeltaPercent: z.number().finite().nullable(),
  todaySaleCount: z.number().int().nonnegative(),
  averageSaleValue: z.number().int().nonnegative(),
  missingCostSaleCount: z.number().int().nonnegative(),
  topItemName: z.string().nullable(),
});

export const dailyInsightSnapshotSchema = z.object({
  date: z.iso.date(),
  revenue: z.number().int().nonnegative(),
  purchases: z.number().int().nonnegative(),
  otherExpenses: z.number().int().nonnegative(),
  estimatedCostOfGoods: z.number().int().nonnegative(),
  estimatedGrossProfit: z.number().int().nullable(),
  transactionCount: z.number().int().nonnegative(),
  saleCount: z.number().int().nonnegative(),
  averageSaleValue: z.number().int().nonnegative(),
  missingCostSaleCount: z.number().int().nonnegative(),
  sevenDay: sevenDayEvidenceSchema.optional(),
}).strict();

export type DailyInsightSnapshot = z.infer<typeof dailyInsightSnapshotSchema>;

export const dailyInsightSchema = z.object({
  headline: z.string().trim().min(1).max(100),
  observations: z.array(z.string().trim().min(1).max(180)).max(2),
  cautions: z.array(z.string().trim().min(1).max(180)).max(2),
}).strict();

export type DailyInsight = z.infer<typeof dailyInsightSchema>;

export const dailyInsightJsonSchema = {
  type: "object",
  properties: {
    headline: { type: "string", maxLength: 100 },
    observations: { type: "array", maxItems: 2, items: { type: "string", maxLength: 180 } },
    cautions: { type: "array", maxItems: 2, items: { type: "string", maxLength: 180 } },
  },
  required: ["headline", "observations", "cautions"],
} as const;
