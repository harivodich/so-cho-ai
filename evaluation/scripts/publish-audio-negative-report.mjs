import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument } from "./shared.mjs";

const sourcePath = path.resolve(argument("--source", "evaluation/results/fleurs-vi-negative-report.json"));
const outputPath = path.resolve(argument("--output", "public/evaluation/fleurs-vi-negative-latest.json"));
const source = JSON.parse(await readFile(sourcePath, "utf8"));

if (source.cases !== 30 || source.negativeCases !== 30 || source.transactionCases !== 0) {
  throw new Error("Chỉ publish report FLEURS gồm đúng 30 public negative-control samples.");
}

const report = {
  version: 1,
  completedAt: new Date().toISOString(),
  model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
  dataset: {
    id: "google-fleurs-vi-vn-validation",
    license: "CC-BY-4.0",
    caseCount: source.cases,
    kind: "public-audio-negative-control",
  },
  metrics: {
    nonTransactionRejection: source.nonTransactionRejection,
    invalidJson: source.invalidJson,
  },
byCondition: Object.fromEntries(Object.entries(source.byCondition ?? {}).map(([condition, value]) => [condition, {
    nonTransactionRejection: value.nonTransactionRejection,
    invalidJson: value.invalidJson,
    errorGroups: value.errorGroups,
  }])),
  errorGroups: source.errorGroups,
  scope: "Vietnamese public speech outside the transaction domain; not transaction extraction accuracy.",
  privacy: "No audio bytes, transcript, speaker identifier, raw model response or API key is published.",
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Published sanitized audio negative-control report to ${path.relative(process.cwd(), outputPath)}.`);
