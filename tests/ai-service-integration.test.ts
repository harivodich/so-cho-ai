import { describe, expect, it } from "vitest";
import { AiApplicationService } from "@/server/ai/service";
import { GeminiProvider } from "@/server/ai/providers/gemini";
import { metrics } from "@/server/observability/metrics";
import { AppHttpError } from "@/server/http/errors";
import type { GenerateStructuredParams, GenerateStructuredResult } from "@/server/ai/provider";

class MockGeminiProvider extends GeminiProvider {
  constructor(
    private readonly mockResult?: unknown,
    private readonly shouldFail = false,
  ) {
    super();
  }

  override async generateStructured(
    _params: GenerateStructuredParams,
  ): Promise<GenerateStructuredResult> {
    void _params;
    if (this.shouldFail) {
      throw new AppHttpError(502, "AI_PROVIDER_ERROR", "Mock provider network failure");
    }

    const rawText = JSON.stringify(this.mockResult ?? []);
    return {
      rawText,
      parsedJson: this.mockResult ?? [],
      latencyMs: 120,
      tokenUsage: { promptTokens: 45, completionTokens: 18, totalTokens: 63 },
    };
  }
}

describe("AiApplicationService Integration Tests", () => {
  it("extracts audio transactions with full metadata, prompt resolution, and data quality checks", async () => {
    metrics.clear();

    const mockOutput = [
      {
        type: "sale",
        itemName: "Xoài Cát Hòa Lộc",
        canonicalItemName: "xoai cat hoa loc",
        quantity: 3,
        unit: "kg",
        unitPrice: 30000,
        amount: 90000,
        occurredAt: "2026-08-22",
        rawInput: "Bán 3 ký xoài cát 90 nghìn",
        fieldsNeedingReview: [],
        missingFields: [],
        warnings: [],
      },
    ];

    const mockProvider = new MockGeminiProvider(mockOutput);
    const service = new AiApplicationService(mockProvider);

    const result = await service.extractAudio({
      audioBase64: "dGVzdC1hdWRpby1ieXRlcw==",
      mimeType: "audio/webm",
      currentDate: "2026-08-22",
      history: [{ amount: 90000, type: "sale", canonicalItemName: "xoai cat hoa loc" }],
    });

    expect(result.drafts.length).toBe(1);
    expect(result.drafts[0].itemName).toBe("Xoài Cát Hòa Lộc");
    expect(result.drafts[0].amount).toBe(90000);
    expect(result.run).toBeDefined();
    expect(result.run.mode).toBe("voice");
    expect(result.run.model).toBe("gemini-2.5-flash");
    expect(result.run.promptVersion).toBe("text-extraction-v2");
    expect(result.run.latencyMs).toBe(120);
    expect(result.run.tokenUsage?.totalTokens).toBe(63);

    const summary = metrics.getSummary();
    expect(summary.ai["gemini-2.5-flash"]).toBeDefined();
    expect(summary.ai["gemini-2.5-flash"].totalCalls).toBe(1);
    expect(summary.ai["gemini-2.5-flash"].successRate).toBe(1);
  });

  it("extracts image invoice lines and builds multi-draft run metadata", async () => {
    const mockImageOutput = [
      {
        type: "purchase",
        itemName: "Bao bì carton",
        canonicalItemName: "bao bi carton",
        quantity: 50,
        unit: "cái",
        unitPrice: 4000,
        amount: 200000,
        occurredAt: "2026-08-22",
        rawInput: "Hóa đơn thùng carton 200k",
        fieldsNeedingReview: [],
        missingFields: [],
        warnings: [],
      },
      {
        type: "expense",
        itemName: "Băng keo",
        canonicalItemName: "bang keo",
        quantity: 5,
        unit: "cuộn",
        unitPrice: 15000,
        amount: 75000,
        occurredAt: "2026-08-22",
        rawInput: "Hóa đơn băng keo 75k",
        fieldsNeedingReview: [],
        missingFields: [],
        warnings: [],
      },
    ];

    const mockProvider = new MockGeminiProvider(mockImageOutput);
    const service = new AiApplicationService(mockProvider);

    const result = await service.extractImage({
      imageBase64: "dGVzdC1pbWFnZS1ieXRlcw==",
      mimeType: "image/jpeg",
      currentDate: "2026-08-22",
    });

    expect(result.drafts.length).toBe(2);
    expect(result.drafts[0].type).toBe("purchase");
    expect(result.drafts[1].type).toBe("expense");
    expect(result.run.draftCount).toBe(2);
    expect(result.run.promptVersion).toBe("image-extraction-v1");
  });

  it("generates daily insight and throws typed AppHttpError 422 on schema violation", async () => {
    const invalidInsightOutput = {
      // Missing required summary / observations / recommendations
      unrecognizedField: "something else",
    };

    const mockProvider = new MockGeminiProvider(invalidInsightOutput);
    const service = new AiApplicationService(mockProvider);

    await expect(
      service.generateDailyInsight({
        snapshot: {
          focusDate: "2026-08-22",
          revenue: 1500000,
          costOfGoods: 800000,
          grossProfit: 700000,
          transactionCount: 12,
          saleCount: 9,
          purchaseCount: 2,
          expenseCount: 1,
          daysWithTransactions: 7,
          topItems: [],
        },
      }),
    ).rejects.toThrowError(AppHttpError);
  });

  it("records failed AI calls to metrics on provider error", async () => {
    metrics.clear();
    const failingProvider = new MockGeminiProvider(null, true);
    const service = new AiApplicationService(failingProvider);

    await expect(
      service.extractAudio({
        audioBase64: "dGVzdA==",
        mimeType: "audio/webm",
        currentDate: "2026-08-22",
      }),
    ).rejects.toThrow("Mock provider network failure");

    const summary = metrics.getSummary();
    expect(summary.ai["gemini-2.5-flash"].totalCalls).toBe(1);
    expect(summary.ai["gemini-2.5-flash"].successRate).toBe(0);
  });
});
