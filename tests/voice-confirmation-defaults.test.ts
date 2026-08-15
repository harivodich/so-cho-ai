import { describe, expect, it } from "vitest";

import { applyVoiceConfirmationDefaults } from "@/lib/voice-confirmation-defaults";
import type { TransactionDraft } from "@/types/transaction";

const draft = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
  type: "sale",
  itemName: "Cam",
  canonicalItemName: "cam",
  quantity: 2,
  unit: "kg",
  unitPrice: null,
  amount: 200_000,
  occurredAt: null,
  rawInput: "bán hai cân cam tổng hai trăm nghìn",
  fieldsNeedingReview: ["unitPrice"],
  missingFields: ["unitPrice", "occurredAt"],
  warnings: [],
  qualityChecks: [],
  ...overrides,
});

describe("applyVoiceConfirmationDefaults", () => {
  it("uses today's date for an otherwise complete voice draft and flags it for review", () => {
    const result = applyVoiceConfirmationDefaults(draft(), "2026-08-15");

    expect(result.occurredAt).toBe("2026-08-15");
    expect(result.missingFields).toEqual(["unitPrice"]);
    expect(result.fieldsNeedingReview).toContain("occurredAt");
    expect(result.warnings).toContain("Đã đặt ngày giao dịch là hôm nay. Sửa lại nếu giao dịch diễn ra ngày khác.");
  });

  it("does not overwrite a date the user spoke", () => {
    const result = applyVoiceConfirmationDefaults(draft({ occurredAt: "2026-08-10", missingFields: ["unitPrice"] }), "2026-08-15");

    expect(result.occurredAt).toBe("2026-08-10");
    expect(result.warnings).toEqual([]);
  });
});
