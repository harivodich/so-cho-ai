import { describe, expect, it } from "vitest";
import { promptRegistry } from "@/server/ai/prompt-registry";
import { getModelConfig, MODEL_REGISTRY } from "@/server/ai/model-registry";
import { analyzeDraftCorrection } from "@/server/ai/feedback";
import type { ConfirmedTransaction, TransactionDraft } from "@/types/transaction";

describe("AI platform contracts & prompt registry", () => {
  it("registers and looks up versioned prompts correctly", () => {
    const textV2 = promptRegistry.get("text-extraction-v2");
    expect(textV2).toBeDefined();
    expect(textV2?.id).toBe("text-extraction");
    expect(textV2?.version).toBe("text-extraction-v2");
    expect(textV2?.buildPrompt({ currentDate: "2026-08-21" })).toContain("2026-08-21");

    const imageV1 = promptRegistry.get("image-extraction-v1");
    expect(imageV1).toBeDefined();
    expect(imageV1?.version).toBe("image-extraction-v1");

    const insightV1 = promptRegistry.get("daily-insight-v1");
    expect(insightV1).toBeDefined();
  });

  it("lists all registered prompts with metadata", () => {
    const list = promptRegistry.listAll();
    expect(list.length).toBeGreaterThanOrEqual(3);
    const versions = list.map((p) => p.version);
    expect(versions).toContain("text-extraction-v2");
    expect(versions).toContain("image-extraction-v1");
    expect(versions).toContain("daily-insight-v1");
  });

  it("provides model configurations with timeouts and capabilities", () => {
    expect(MODEL_REGISTRY["gemini-2.5-flash"]).toBeDefined();
    const flashConfig = getModelConfig("gemini-2.5-flash");
    expect(flashConfig.modelName).toBe("gemini-2.5-flash");
    expect(flashConfig.supportsAudio).toBe(true);
    expect(flashConfig.supportsVision).toBe(true);
    expect(flashConfig.timeoutMs).toBeGreaterThan(10_000);

    const fallbackConfig = getModelConfig("non-existent-model");
    expect(fallbackConfig.id).toBe("gemini-2.5-flash");
  });

  it("accurately detects human corrections in draft confirmation feedback", () => {
    const draft: TransactionDraft = {
      type: "sale",
      itemName: "Xoai",
      canonicalItemName: "Xoài cát",
      amount: 50000,
      quantity: 1,
      unit: "kg",
      unitPrice: 50000,
      occurredAt: "2026-08-21",
      rawInput: "Ban xoai 50k",
      fieldsNeedingReview: [],
      missingFields: [],
      warnings: [],
      qualityChecks: [],
    };

    const confirmed: ConfirmedTransaction = {
      ...draft,
      id: "tx-1",
      userId: "user-1",
      inputMethod: "voice",
      amount: 80000, // modified from 50k to 80k
      quantity: 2, // modified from 1 to 2
      confirmedAt: "2026-08-21T10:00:00Z",
      createdAt: "2026-08-21T10:00:00Z",
      updatedAt: "2026-08-21T10:00:00Z",
    };

    const corrections = analyzeDraftCorrection("run-123", "voice", draft, confirmed);
    const amountCorrection = corrections.find((c) => c.field === "amount");
    const quantityCorrection = corrections.find((c) => c.field === "quantity");
    const typeCorrection = corrections.find((c) => c.field === "type");

    expect(amountCorrection?.wasModified).toBe(true);
    expect(quantityCorrection?.wasModified).toBe(true);
    expect(typeCorrection?.wasModified).toBe(false);
  });
});
