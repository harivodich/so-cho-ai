import { describe, expect, it } from "vitest";

import { canonicalizeItemName, createManualDraft, transactionDraftSchema } from "../src/types/transaction";

describe("transaction draft helpers", () => {
  it("canonicalizes item names without removing Vietnamese diacritics", () => {
    expect(canonicalizeItemName("  Xoài   Cát  ")).toBe("xoài cát");
  });

  it("rejects tax subtotals that do not match the transaction amount", () => {
    const draft = createManualDraft({ type: "sale", itemName: "Xoài", amount: 100_000, occurredAt: "2026-08-09" });
    expect(transactionDraftSchema.safeParse({ ...draft, tax: { applied: true, subtotal: 99_000, taxRatePercent: 2, taxAmount: 1_980, total: 100_980 } }).success).toBe(false);
  });
  it("warns when amount conflicts with quantity times unit price", () => {
    const draft = createManualDraft({
      type: "sale",
      itemName: "Xoài",
      quantity: 20,
      unit: "kg",
      unitPrice: 35_000,
      amount: 650_000,
      occurredAt: "2026-08-09",
    });

    expect(draft.warnings).toHaveLength(1);
  });
});
