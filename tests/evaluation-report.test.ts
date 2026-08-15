import { describe, expect, it } from "vitest";

import { formatEvaluationPercent, parseLatestEvaluationReport } from "@/lib/evaluation/latest-report";

const validReport = {
  model: "gemini-2.5-flash",
  promptVersion: "text-extraction-v2",
  completedAt: "2026-08-13T03:12:13.068Z",
  cases: 60,
  transactionCases: 55,
  negativeCases: 5,
  fields: Object.fromEntries(["type", "amount", "quantity", "unitPrice"].map((field) => [field, { correct: 55, total: 55, accuracy: 100 }])),
  wholeTransaction: { correct: 50, total: 55, accuracy: 90.91 },
  nonTransactionRejection: { correct: 5, total: 5, accuracy: 100 },
  invalidJson: { count: 0, total: 60, rate: 0 },
  requiresHumanReview: { count: 4, total: 55, rate: 7.27 },
  errorGroups: { "field:amount": 1 },
};

describe("latest evaluation report", () => {
  it("accepts the safe, publishable evaluation shape", () => {
    expect(parseLatestEvaluationReport(validReport)).toMatchObject({ model: "gemini-2.5-flash", cases: 60 });
    expect(formatEvaluationPercent(90.91)).toBe("90,91%");
  });

  it("rejects incomplete or malformed metrics", () => {
    expect(parseLatestEvaluationReport({ ...validReport, fields: {} })).toBeNull();
  });
});
