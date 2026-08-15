import { describe, expect, it, vi } from "vitest";

import { extractTransactionFromAudio } from "@/lib/extraction/gemini";
import { parseExtractionDrafts, transactionDraftsJsonSchema } from "@/lib/extraction/schema";

describe("empty audio extraction", () => {
  it("accepts an empty draft list for silence or non-transaction speech", () => {
    expect(parseExtractionDrafts([], "2026-08-12")).toEqual([]);
    expect(transactionDraftsJsonSchema.minItems).toBe(0);
  });

  it("keeps an empty Gemini response empty instead of inventing a transaction", async () => {
    const previousApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ text: "[]" }] } }] })) as unknown as typeof fetch;

    try {
      await expect(
        extractTransactionFromAudio(
          { audioBase64: "AA==", mimeType: "audio/wav", currentDate: "2026-08-12" },
          fetchMock,
        ),
      ).resolves.toEqual([]);
    } finally {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
  });
});
