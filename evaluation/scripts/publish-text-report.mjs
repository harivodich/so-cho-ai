import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, readJsonLines } from "./shared.mjs";

const sourcePath = path.resolve(argument("--source", "evaluation/results/text-report.json"));
const datasetPath = path.resolve(argument("--dataset", "evaluation/datasets/synthetic-text-v1.jsonl"));
const resultsPath = path.resolve(argument("--results", "evaluation/results/text-run.jsonl"));
const outputPath = path.resolve(argument("--output", "public/evaluation/text-latest.json"));
const report = JSON.parse(await readFile(sourcePath, "utf8"));
if (!report.model || report.model === "fixture") throw new Error("Chỉ publish evaluation đã gọi model thật; fixture không được đưa lên UI.");

const fields = ["type", "amount", "quantity", "unitPrice"];
const rows = await readJsonLines(datasetPath);
const results = await readJsonLines(resultsPath);
const resultById = new Map(results.map((result) => [result.id, result]));
const matches = (expected, actual) => fields.every((field) => (expected?.[field] ?? null) === (actual?.[field] ?? null));
const sample = (row, actual, note) => ({ id: row.id, input: row.input, expected: row.expected, actual: actual ?? null, note });
const correctRow = rows.find((row) => row.expected !== null && matches(row.expected, resultById.get(row.id)?.actual));
const incorrectRow = rows.find((row) => row.expected !== null && !matches(row.expected, resultById.get(row.id)?.actual));
const guardRow = rows.find((row) => {
  const actual = resultById.get(row.id)?.actual;
  return actual !== null && actual?.quantity !== null && actual?.unitPrice !== null && actual?.amount !== null && Math.round(actual.quantity * actual.unitPrice) !== actual.amount;
});
if (!correctRow || !incorrectRow || !guardRow) throw new Error("Report không đủ ví dụ đúng, sai và validation để publish dashboard.");

const published = {
  model: report.model, promptVersion: report.promptVersion, completedAt: report.completedAt,
  cases: report.cases, transactionCases: report.transactionCases, negativeCases: report.negativeCases,
  fields: report.fields, wholeTransaction: report.wholeTransaction, nonTransactionRejection: report.nonTransactionRejection,
  invalidJson: report.invalidJson, requiresHumanReview: report.requiresHumanReview, errorGroups: report.errorGroups,
  examples: {
    correct: sample(correctRow, resultById.get(correctRow.id)?.actual, "Bốn trường đo đều khớp nhãn đã khóa trước khi gọi model."),
    incorrect: sample(incorrectRow, resultById.get(incorrectRow.id)?.actual, "Model lệch ít nhất một trường; người dùng vẫn phải xác nhận trước khi lưu."),
    validationDetected: sample(guardRow, resultById.get(guardRow.id)?.actual, "Quantity × unit price không khớp amount; Data Quality Guard sẽ yêu cầu kiểm tra, không tự sửa."),
  },
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(published, null, 2)}\n`, "utf8");
console.log(`Đã publish evaluation thật vào ${path.relative(process.cwd(), outputPath)}.`);
