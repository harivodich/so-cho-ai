import { describe, expect, it } from "vitest";

import { applyDataQualityGuard } from "@/lib/extraction/data-quality";
import type { TransactionDraft } from "@/types/transaction";

const draft = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
  type: "sale", itemName: "Xoài", canonicalItemName: "xoài", quantity: 2, unit: "kg", unitPrice: 40_000, amount: 80_000,
  occurredAt: "2026-08-12", rawInput: "bán hai ký xoài tám mươi nghìn", fieldsNeedingReview: [], missingFields: [], warnings: [], qualityChecks: [], ...overrides,
});

describe("applyDataQualityGuard", () => {
  it("explains a multiplication mismatch without changing the AI value", () => {
    const result = applyDataQualityGuard(draft({ amount: 70_000 }), { currentDate: "2026-08-12" });
    expect(result.amount).toBe(70_000);
    expect(result.qualityChecks[0]).toMatchObject({ field: "amount", value: "70000" });
    expect(result.qualityChecks[0].reason).toContain("không khớp");
    expect(result.qualityChecks[0].action).toContain("Kiểm tra");
  });

  it("flags missing type and amount with a concrete user action", () => {
    const result = applyDataQualityGuard(draft({ type: null, amount: null }), { currentDate: "2026-08-12" });
    expect(result.missingFields).toEqual(expect.arrayContaining(["type", "amount"]));
    expect(result.qualityChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "type", value: "null", action: expect.stringContaining("Chọn") }),
      expect.objectContaining({ field: "amount", value: "null", action: expect.stringContaining("Nhập") }),
    ]));
  });

  it("flags non-positive VND values without mutating them", () => {
    const result = applyDataQualityGuard(draft({ amount: 0 }), { currentDate: "2026-08-12" });
    expect(result.amount).toBe(0);
    expect(result.qualityChecks).toContainEqual(expect.objectContaining({ field: "amount", value: "0" }));
  });

  it("flags future dates", () => {
    const result = applyDataQualityGuard(draft({ occurredAt: "2026-08-13" }), { currentDate: "2026-08-12" });
    expect(result.qualityChecks).toContainEqual(expect.objectContaining({ field: "occurredAt" }));
  });

  it("flags multiple transaction signals and asks the user to split them", () => {
    const result = applyDataQualityGuard(draft({ rawInput: "bán xoài tám mươi nghìn rồi chi mười nghìn giữ xe" }), { currentDate: "2026-08-12" });
    expect(result.qualityChecks).toContainEqual(expect.objectContaining({ field: "transactionCount", action: expect.stringContaining("Tách") }));
  });

  it("flags an outlier only with at least three comparable user-history transactions", () => {
    const history = [
      { type: "sale" as const, amount: 80_000, canonicalItemName: "xoài" },
      { type: "sale" as const, amount: 100_000, canonicalItemName: "xoài" },
      { type: "sale" as const, amount: 90_000, canonicalItemName: "xoài" },
    ];
    expect(applyDataQualityGuard(draft({ amount: 500_000 }), { currentDate: "2026-08-12", history }).qualityChecks).toContainEqual(expect.objectContaining({ field: "amount", reason: expect.stringContaining("cao bất thường") }));
    expect(applyDataQualityGuard(draft({ amount: 500_000 }), { currentDate: "2026-08-12", history: history.slice(0, 2) }).qualityChecks).not.toContainEqual(expect.objectContaining({ reason: expect.stringContaining("cao bất thường") }));
  });
});
