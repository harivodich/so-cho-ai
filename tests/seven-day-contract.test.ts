import { describe, expect, it, vi } from "vitest";

import { generateDailyInsight } from "@/lib/insights/gemini";
import { dailyInsightSnapshotSchema } from "@/lib/insights/schema";
import { calculateSevenDayEvidence } from "@/lib/insights/seven-day";
import type { ConfirmedTransaction } from "@/types/transaction";

const sale = (id: string, occurredAt: string, amount: number): ConfirmedTransaction => ({
  id, userId: "private-user", type: "sale", itemName: "Xoài", canonicalItemName: "xoài", quantity: 1, unit: "kg", unitPrice: amount, amount, occurredAt,
  rawInput: "private audio transcript", fieldsNeedingReview: [], missingFields: [], warnings: [], qualityChecks: [], inputMethod: "manual",
  confirmedAt: "2026-08-13T00:00:00.000Z", createdAt: "2026-08-13T00:00:00.000Z", updatedAt: "2026-08-13T00:00:00.000Z",
});

const snapshot = {
  date: "2026-08-13", revenue: 140_000, purchases: 0, otherExpenses: 0, estimatedCostOfGoods: 0, estimatedGrossProfit: null,
  transactionCount: 1, saleCount: 1, averageSaleValue: 140_000, missingCostSaleCount: 1,
  sevenDay: { startDate: "2026-08-07", endDate: "2026-08-13", todayRevenue: 140_000, averageDailyRevenue: 30_000, revenueDelta: 110_000, revenueDeltaPercent: 366.67, todaySaleCount: 1, averageSaleValue: 140_000, missingCostSaleCount: 2, topItemName: "Xoài" },
};

describe("seven-day insight contract", () => {
  it("counts missing-cost sales across the full evidence period", () => {
    const evidence = calculateSevenDayEvidence([sale("old", "2026-08-07", 70_000), sale("today", "2026-08-13", 140_000)], "2026-08-13");
    expect(evidence.averageDailyRevenue).toBe(30_000);
    expect(evidence.missingCostSaleCount).toBe(2);
    expect(evidence.revenueDeltaPercent).toBeCloseTo(366.666, 2);
  });

  it("rejects raw transaction arrays from the insight request", () => {
    expect(() => dailyInsightSnapshotSchema.parse({ ...snapshot, transactions: [sale("secret", "2026-08-13", 1)] })).toThrow();
  });

  it("sends the aggregate seven-day evidence but no private transaction fields to Gemini", async () => {
    const previousApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: "Có dữ liệu", observations: [], cautions: ["Chưa đủ giá vốn."] }) }] } }] })) as unknown as typeof fetch;
    try {
      await generateDailyInsight(snapshot, fetchMock);
      const request = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
      const aggregateText = request.contents[0].parts[0].text as string;
      expect(aggregateText).toContain('"averageDailyRevenue":30000');
      expect(aggregateText).not.toContain("private-user");
      expect(aggregateText).not.toContain("private audio transcript");
      expect(aggregateText).not.toContain('"transactions"');
    } finally { process.env.GEMINI_API_KEY = previousApiKey; }
  });
});
