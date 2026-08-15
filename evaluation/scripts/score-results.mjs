import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, assertUniqueIds, readJsonLines } from "./shared.mjs";
import { evaluationMarkdown, scoreByCondition, scoreEvaluation } from "./metrics.mjs";

const expectedPath = argument("--expected");
const actualPath = argument("--actual");
const reportPath = argument("--report");
const markdownPath = argument("--markdown");

if (!expectedPath || !actualPath) {
  throw new Error("Dùng: node evaluation/scripts/score-results.mjs --expected <expected.jsonl> --actual <actual.jsonl> [--report report.json --markdown report.md]");
}

const expectedRows = await readJsonLines(expectedPath);
const actualRows = await readJsonLines(actualPath);
assertUniqueIds(expectedRows);
assertUniqueIds(actualRows);

const normalizedActualRows = actualRows.map((row) => ({
  ...row,
  outcome: row.outcome ?? (row.httpStatus >= 200 && row.httpStatus < 300 ? "valid" : "http-error"),
}));
const report = {
  ...scoreEvaluation(expectedRows, normalizedActualRows),
  byCondition: scoreByCondition(expectedRows, normalizedActualRows),
};

if (reportPath) {
  const resolved = path.resolve(reportPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (markdownPath) {
  const resolved = path.resolve(markdownPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, evaluationMarkdown(report), "utf8");
}

console.log(JSON.stringify(report, null, 2));
