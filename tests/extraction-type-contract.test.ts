import { describe, expect, it } from "vitest";

import { parseExtractionDrafts } from "@/lib/extraction/schema";

describe("extraction type contract", () => {
  it("rejects a type outside sale, purchase and expense before the guard runs", () => {
    expect(() => parseExtractionDrafts([{
      type: "refund", itemName: null, canonicalItemName: null, quantity: null, unit: null, unitPrice: null, amount: 10_000,
      occurredAt: null, rawInput: "hoàn tiền mười nghìn", fieldsNeedingReview: [], missingFields: [], warnings: [], qualityChecks: [],
    }], "2026-08-13")).toThrow();
  });
});
