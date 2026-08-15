import { describe, expect, it } from "vitest";

import { parseExtractionDrafts } from "../src/lib/extraction/schema";

describe("parseExtractionDrafts", () => {
  it("adds missing review fields instead of inventing absent values", () => {
    const [draft] = parseExtractionDrafts(
      [{
        type: "sale",
        itemName: "Xoài Cát",
        canonicalItemName: null,
        quantity: null,
        unit: null,
        unitPrice: null,
        amount: 80_000,
        occurredAt: null,
        rawInput: "bán xoài tám mươi nghìn",
        fieldsNeedingReview: [],
        missingFields: [],
        warnings: [],
      }],
      "2026-08-12",
    );

    expect(draft.canonicalItemName).toBe("xoài cát");
    expect(draft.missingFields).toContain("occurredAt");
    expect(draft.amount).toBe(80_000);
  });

  it("rejects non-integer VND values", () => {
    expect(() =>
      parseExtractionDrafts(
        [{
          type: "expense",
          itemName: null,
          canonicalItemName: null,
          quantity: null,
          unit: null,
          unitPrice: null,
          amount: 10.5,
          occurredAt: "2026-08-12",
          rawInput: "trả mười nghìn rưỡi",
          fieldsNeedingReview: [],
          missingFields: [],
          warnings: [],
        }],
        "2026-08-12",
      ),
    ).toThrow("Tổng tiền phải là số nguyên VND.");
  });
});
