import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, assertUniqueIds, readJsonLines } from "./shared.mjs";

const manifestPath = path.resolve(argument("--manifest", "evaluation/datasets/synthetic-text-v1.jsonl"));
const outputPath = path.resolve(argument("--output", "evaluation/fixtures/text-eval-perfect.jsonl"));
const rows = await readJsonLines(manifestPath);
assertUniqueIds(rows);
const resultRows = rows.map((row) => ({
  id: row.id,
  actual: row.expected === null ? null : { ...row.expected, fieldsNeedingReview: [], missingFields: [], warnings: [] },
  outcome: "valid",
  httpStatus: 200,
  error: null,
}));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${resultRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
console.log(`Đã tạo fixture ${path.relative(process.cwd(), outputPath)} từ ${rows.length} nhãn synthetic đã khóa.`);
