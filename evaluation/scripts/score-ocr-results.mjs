import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, assertUniqueIds, readJsonLines } from "./shared.mjs";

const expectedPath = path.resolve(argument("--expected", "evaluation/fixtures/ocr-printed-invoice-png.jsonl"));
const actualPath = path.resolve(argument("--actual", "evaluation/results/ocr-run.jsonl"));
const reportPath = path.resolve(argument("--report", "evaluation/results/ocr-report.json"));
const markdownPath = path.resolve(argument("--markdown", "evaluation/results/ocr-report.md"));
const expected = await readJsonLines(expectedPath);
const actual = await readJsonLines(actualPath);
assertUniqueIds(expected);
assertUniqueIds(actual);
const actualById = new Map(actual.map((row) => [row.id, row]));
const fields = ["type", "itemName", "quantity", "unitPrice", "amount"];
const fieldStats = Object.fromEntries(fields.map((field) => [field, { correct: 0, total: 0 }]));
const groups = {};
let completeCorrect = 0;
let completeTotal = 0;
let clearPrintedCorrect = 0;
let clearPrintedTotal = 0;
let negativeCorrect = 0;
let negativeTotal = 0;
const errors = [];
const equal = (left, right) => left === right || (left == null && right == null);
for (const row of expected) {
  const result = actualById.get(row.id);
  if (!result) throw new Error(`Thiếu kết quả cho ${row.id}.`);
  const drafts = Array.isArray(result.actualDrafts) ? result.actualDrafts : [];
  const expectedDrafts = Array.isArray(row.expectedDrafts) ? row.expectedDrafts : [];
  const isNegative = expectedDrafts.length === 0;
  const isClearPrinted = row.quality === "clear" || row.quality === "clear-missing-field";
  if (isNegative) {
    negativeTotal += 1;
    if (drafts.length === 0) negativeCorrect += 1;
  }
  const linesCorrect = drafts.length === expectedDrafts.length && expectedDrafts.every((expectedDraft, index) => {
    const actualDraft = drafts[index] ?? {};
    let lineFieldsCorrect = true;
    for (const field of fields) {
      fieldStats[field].total += 1;
      const correct = equal(actualDraft[field], expectedDraft[field]);
      if (correct) fieldStats[field].correct += 1;
      else lineFieldsCorrect = false;
    }
    return lineFieldsCorrect && equal(actualDraft.unit, expectedDraft.unit) && equal(actualDraft.occurredAt, expectedDraft.occurredAt);
  });
  if (!isNegative) {
    completeTotal += 1;
    if (linesCorrect) completeCorrect += 1;
    if (isClearPrinted) {
      clearPrintedTotal += 1;
      if (linesCorrect) clearPrintedCorrect += 1;
    }
  }
  const group = groups[row.quality] ??= { cases: 0, completeCorrect: 0, completeTotal: 0 };
  group.cases += 1;
  if (!isNegative) {
    group.completeTotal += 1;
    if (linesCorrect) group.completeCorrect += 1;
  }
  if (!linesCorrect && !isNegative) errors.push(row.id);
}
const percentage = (correct, total) => total === 0 ? null : Number((correct * 100 / total).toFixed(2));
const completeAccuracy = percentage(completeCorrect, completeTotal);
const clearPrintedAccuracy = percentage(clearPrintedCorrect, clearPrintedTotal);
const MIN_CLEAR_PRINTED_ACCURACY = 80;
const report = {
  dataset: path.relative(process.cwd(), expectedPath),
  actual: path.relative(process.cwd(), actualPath),
  samples: expected.length,
  completeTransaction: { correct: completeCorrect, total: completeTotal, accuracy: completeAccuracy },
  releaseGate: {
    minimumClearPrintedAccuracy: MIN_CLEAR_PRINTED_ACCURACY,
    accuracy: clearPrintedAccuracy,
    passed: clearPrintedAccuracy !== null && clearPrintedAccuracy >= MIN_CLEAR_PRINTED_ACCURACY,
  },
  negativeCases: { correct: negativeCorrect, total: negativeTotal, rejectionRate: percentage(negativeCorrect, negativeTotal) },
  fields: Object.fromEntries(Object.entries(fieldStats).map(([field, stat]) => [field, { ...stat, accuracy: percentage(stat.correct, stat.total) }])),
  byQuality: Object.fromEntries(Object.entries(groups).map(([quality, group]) => [quality, { ...group, accuracy: percentage(group.completeCorrect, group.completeTotal) }])),
  incorrectPositiveIds: errors,
};
const markdown = [
  "# OCR evaluation report", "", `- Dataset: \`${report.dataset}\``, `- Samples: ${report.samples}`,
  `- Complete positive accuracy: ${report.completeTransaction.accuracy ?? "n/a"}% (${completeCorrect}/${completeTotal})`,
  `- Clear printed accuracy: ${clearPrintedAccuracy ?? "n/a"}% (${clearPrintedCorrect}/${clearPrintedTotal})`,
  `- Clear printed invoice release gate: ${report.releaseGate.passed ? "PASS" : "BETA"} (minimum ${MIN_CLEAR_PRINTED_ACCURACY}%)`,
  `- Negative rejection rate: ${report.negativeCases.rejectionRate ?? "n/a"}% (${negativeCorrect}/${negativeTotal})`, "", "## Field accuracy", "",
  "| Field | Correct | Total | Accuracy |", "|---|---:|---:|---:|",
  ...Object.entries(report.fields).map(([field, stat]) => `| ${field} | ${stat.correct} | ${stat.total} | ${stat.accuracy ?? "n/a"}% |`),
  "", "## By quality", "", "| Quality | Cases | Complete accuracy |", "|---|---:|---:|",
  ...Object.entries(report.byQuality).map(([quality, group]) => `| ${quality} | ${group.cases} | ${group.accuracy ?? "n/a"}% |`),
  "", `Incorrect positive IDs: ${errors.length ? errors.join(", ") : "none"}`, "",
].join("\n");
await mkdir(path.dirname(reportPath), { recursive: true });
await Promise.all([writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"), writeFile(markdownPath, markdown, "utf8")]);
console.log(`Đã chấm ${expected.length} mẫu. Complete accuracy: ${report.completeTransaction.accuracy ?? "n/a"}%.`);