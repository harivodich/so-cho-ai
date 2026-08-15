import { describe, expect, it } from "vitest";

import { calculateSevenDayEvidence } from "@/lib/insights/seven-day";
import type { ConfirmedTransaction } from "@/types/transaction";

const transaction = (id: string, occurredAt: string, amount: number): ConfirmedTransaction => ({
  id, userId: "user", type: "sale", itemName: "Xoài", canonicalItemName: "xoài", quantity: 1, unit: "kg", unitPrice: amount, amount, occurredAt,
  rawInput: "", fieldsNeedingReview: [], missingFields: [], warnings: [], qualityChecks: [], inputMethod: "manual", confirmedAt: "2026-08-12T00:00:00.000Z", createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z",
});

describe("calculateSevenDayEvidence", () => {
  it("computes evidence in code, including the 7-day daily average", () => {
    const evidence = calculateSevenDayEvidence([
      transaction("one", "2026-08-06", 70_000),
      transaction("two", "2026-08-12", 140_000),
    ], "2026-08-12");

    expect(evidence.averageDailyRevenue).toBe(30_000);
    expect(evidence.revenueDelta).toBe(110_000);
    expect(evidence.topItemName).toBe("Xoài");
  });
});
