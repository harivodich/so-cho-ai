import { describe, expect, it } from "vitest";

import { imageTransactionDraftsJsonSchema, parseImageExtractionDrafts } from "@/lib/extraction/schema";

const draft = {
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
};

describe("printed invoice extraction contract", () => {
  it("allows up to 20 lines while preserving a typed draft", () => {
    expect(imageTransactionDraftsJsonSchema.maxItems).toBe(20);
    const drafts = parseImageExtractionDrafts([draft, { ...draft, itemName: "cam" }], "2026-08-12");
    expect(drafts).toHaveLength(2);
    expect(drafts[0].amount).toBe(80_000);
  });
});
