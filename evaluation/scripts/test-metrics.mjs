import assert from "node:assert/strict";

import { scoreByCondition, scoreEvaluation } from "./metrics.mjs";

const expected = [
  { id: "sale-clear", condition: "clear", expected: { type: "sale", amount: 80_000, quantity: 2, unitPrice: 40_000 } },
  { id: "sale-noisy", condition: "noisy", expected: { type: "sale", amount: 80_000, quantity: 2, unitPrice: 40_000 } },
  { id: "noise", condition: "clear", expected: null },
  { id: "unavailable-negative", condition: "noisy", expected: null },
];
const actual = [
  { id: "sale-clear", actual: { type: "sale", amount: 80_000, quantity: 2, unitPrice: 40_000, warnings: [] }, outcome: "valid" },
  { id: "sale-noisy", actual: { type: "sale", amount: 70_000, quantity: 2, unitPrice: 40_000, warnings: [] }, outcome: "valid" },
  { id: "noise", actual: null, outcome: "valid" },
  { id: "unavailable-negative", actual: null, outcome: "http-error" },
];

const report = scoreEvaluation(expected, actual);
assert.equal(report.fields.amount.accuracy, 50);
assert.equal(report.wholeTransaction.accuracy, 50);
assert.equal(report.nonTransactionRejection.accuracy, 50);
assert.equal(report.requiresHumanReview.rate, 50);
assert.equal(report.invalidJson.rate, 0);
assert.equal(report.errorGroups["http-error"], 1);
assert.throws(() => scoreEvaluation(expected, actual.slice(0, 1)), /mỗi mẫu/);

const byCondition = scoreByCondition(expected, actual);
assert.equal(byCondition.clear.cases, 2);
assert.equal(byCondition.clear.wholeTransaction.accuracy, 100);
assert.equal(byCondition.noisy.cases, 2);
assert.equal(byCondition.noisy.wholeTransaction.accuracy, 0);
assert.equal(byCondition.noisy.nonTransactionRejection.accuracy, 0);

console.log("Evaluation metric tests passed.");
