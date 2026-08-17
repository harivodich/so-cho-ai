import { describe, expect, it } from "vitest";

import { calculateCashFlowSummary } from "@/lib/reports/cash-flow";
import type { DebtEntry } from "@/types/debt";
import type { ConfirmedTransaction } from "@/types/transaction";

const transaction = (partial: Partial<ConfirmedTransaction>): ConfirmedTransaction => ({
  id: "t1",
  userId: "uid-a",
  inputMethod: "manual",
  type: "sale",
  itemName: "Xoài",
  canonicalItemName: "xoài",
  quantity: 1,
  unit: "kg",
  unitPrice: 100000,
  amount: 100000,
  occurredAt: "2026-08-10",
  rawInput: "",
  fieldsNeedingReview: [],
  missingFields: [],
  warnings: [],
  qualityChecks: [],
  confirmedAt: "2026-08-10T00:00:00.000Z",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  ...partial,
});

const debt = (partial: Partial<DebtEntry>): DebtEntry => ({
  id: "d1",
  userId: "uid-a",
  partyName: "Khách",
  direction: "receivable",
  amount: 100000,
  dueDate: null,
  note: "",
  status: "partial",
  paidAmount: 40000,
  payments: [{ id: "p1", amount: 40000, paidAt: "2026-08-11", note: "" }],
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  ...partial,
});

describe("cash-flow summary", () => {
  it("keeps recognized revenue separate from recorded debt cash", () => {
    const result = calculateCashFlowSummary(
      [transaction({ amount: 100000 })],
      [debt({}), debt({ id: "d2", direction: "payable", payments: [{ id: "p2", amount: 10000, paidAt: "2026-08-12", note: "" }] })],
      "2026-08-01",
      "2026-08-31",
    );

    expect(result.recognizedRevenue).toBe(100000);
    expect(result.recordedReceipts).toBe(40000);
    expect(result.recordedPayments).toBe(10000);
    expect(result.netRecordedCash).toBe(30000);
  });

  it("ignores payments outside the selected period", () => {
    const result = calculateCashFlowSummary(
      [transaction({ occurredAt: "2026-07-31" })],
      [debt({ payments: [{ id: "p1", amount: 40000, paidAt: "2026-09-01", note: "" }] })],
      "2026-08-01",
      "2026-08-31",
    );

    expect(result).toMatchObject({ recognizedRevenue: 0, recordedReceipts: 0, recordedPayments: 0, netRecordedCash: 0 });
  });
});
