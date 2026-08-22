import { afterEach, describe, expect, it, vi } from "vitest";

import { extractTransactionsFromImage } from "@/lib/extraction/gemini";

const previousApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  process.env.GEMINI_API_KEY = previousApiKey;
});

describe("extractTransactionsFromImage", () => {
  it("sends an inline image and parses multiple invoice lines", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify([
        {
          type: "sale",
          itemName: "xoài",
          canonicalItemName: "xoài",
          quantity: 2,
          unit: "kg",
          unitPrice: 40_000,
          amount: 80_000,
          occurredAt: "2026-08-12",
          rawInput: "xoài 2 kg 40.000 80.000",
          fieldsNeedingReview: [],
          missingFields: [],
          warnings: [],
        },
        {
          type: "sale",
          itemName: "cam",
          canonicalItemName: "cam",
          quantity: 1,
          unit: "kg",
          unitPrice: 35_000,
          amount: 35_000,
          occurredAt: "2026-08-12",
          rawInput: "cam 1 kg 35.000 35.000",
          fieldsNeedingReview: [],
          missingFields: [],
          warnings: [],
        },
      ]) }] } }],
    })) as unknown as typeof fetch;

    const drafts = await extractTransactionsFromImage(
      { imageBase64: "AA==", mimeType: "image/jpeg", currentDate: "2026-08-12" },
      fetchMock,
    );

    expect(drafts).toHaveLength(2);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.contents[0].parts[1]).toMatchObject({ inlineData: { mimeType: "image/jpeg", data: "AA==" } });
    expect(body.generationConfig.responseSchema.maxItems).toBe(20);
    expect(String(body.contents[0].parts[0].text)).toContain("untrusted data");
  });
});
