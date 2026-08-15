import { describe, expect, it } from "vitest";

import { parseLatestEvaluationReport } from "@/lib/evaluation/latest-report";

const baseReport = {
  model: "gemini-2.5-flash",
  promptVersion: "text-extraction-v2",
  completedAt: "2026-08-13T09:00:00.000Z",
  cases: 60,
  transactionCases: 55,
  negativeCases: 5,
  fields: {
    type: { correct: 52, total: 55, accuracy: 94.55 },
    amount: { correct: 52, total: 55, accuracy: 94.55 },
    quantity: { correct: 52, total: 55, accuracy: 94.55 },
    unitPrice: { correct: 54, total: 55, accuracy: 98.18 },
  },
  wholeTransaction: { correct: 46, total: 55, accuracy: 83.64 },
  nonTransactionRejection: { correct: 5, total: 5, accuracy: 100 },
  invalidJson: { count: 0, total: 60, rate: 0 },
  requiresHumanReview: { count: 35, total: 55, rate: 63.64 },
  errorGroups: { type: 3, amount: 3, quantity: 3, unitPrice: 1 },
};

describe("published evaluation examples", () => {
  it("keeps expected and actual synthetic fields for transparent review", () => {
    const report = parseLatestEvaluationReport({
      ...baseReport,
      examples: {
        correct: {
          id: "text-001",
          input: "Bán 2 kg xoài, 70 nghìn một ký.",
          expected: { type: "sale", quantity: 2, unit: "kg", unitPrice: 70000, amount: 140000 },
          actual: { type: "sale", quantity: 2, unit: "kg", unitPrice: 70000, amount: 140000 },
          note: "Các trường trọng yếu khớp nhãn kỳ vọng.",
        },
        incorrect: {
          id: "text-042",
          input: "Bán 2 kg xoài, 70 nghìn một ký.",
          expected: { type: "sale", amount: 140000 },
          actual: { type: "purchase", amount: 140000 },
          note: "Model nhận sai loại giao dịch.",
        },
        validationDetected: {
          id: "text-059",
          input: "Bán 2 kg xoài, 70 nghìn một ký, tổng 999 nghìn.",
          expected: { type: "sale", quantity: 2, unitPrice: 70000, amount: 999000 },
          actual: { type: "sale", quantity: 2, unitPrice: 70000, amount: 999000 },
          note: "Guard yêu cầu xác nhận lại tổng tiền không khớp phép nhân.",
        },
      },
    });

    expect(report?.examples?.validationDetected).toMatchObject({
      id: "text-059",
      note: "Guard yêu cầu xác nhận lại tổng tiền không khớp phép nhân.",
    });
  });

  it("rejects a partially published example set", () => {
    const report = parseLatestEvaluationReport({
      ...baseReport,
      examples: { correct: { id: "text-001" } },
    });

    expect(report).toBeNull();
  });
});
