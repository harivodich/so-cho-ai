import { afterEach, describe, expect, it, vi } from "vitest";

import { generateDailyInsight } from "@/lib/insights/gemini";
import { dailyInsightSnapshotSchema } from "@/lib/insights/schema";

const snapshot = {
  date: "2026-08-12",
  revenue: 400_000,
  purchases: 0,
  otherExpenses: 20_000,
  estimatedCostOfGoods: 0,
  estimatedGrossProfit: null,
  transactionCount: 2,
  saleCount: 1,
  averageSaleValue: 400_000,
  missingCostSaleCount: 1,
};

const previousApiKey = process.env.GEMINI_API_KEY;
afterEach(() => { process.env.GEMINI_API_KEY = previousApiKey; });

describe("daily insight", () => {
  it("accepts only integer aggregate data", () => {
    expect(dailyInsightSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(() => dailyInsightSnapshotSchema.parse({ ...snapshot, revenue: 10.5 })).toThrow();
  });

  it("sends only aggregate data and validates structured output", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        headline: "Ngày bán có doanh thu nhưng chưa đủ giá vốn",
        observations: ["Đã ghi một giao dịch bán."],
        cautions: ["Chưa thể nhận xét lãi gộp."],
      }) }] } }],
    })) as unknown as typeof fetch;

    const result = await generateDailyInsight(snapshot, fetchMock);
    expect(result.cautions).toHaveLength(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.contents[0].parts[0].text).toContain('"revenue":400000');
    expect(body.contents[0].parts[0].text).not.toContain("itemName");
    expect(body.generationConfig.response_mime_type).toBe("application/json");
    expect(body.generationConfig.response_schema.additionalProperties).toBeUndefined();
    expect(String(fetchMock.mock.calls[0][0])).toContain("gemini-2.5-flash:generateContent");
  });

  it("rejects an oversized or malformed model response", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: "x".repeat(101), observations: [], cautions: [] }) }] } }],
    })) as unknown as typeof fetch;

    await expect(generateDailyInsight(snapshot, fetchMock)).rejects.toMatchObject({ kind: "invalid-response" });
  });
});
