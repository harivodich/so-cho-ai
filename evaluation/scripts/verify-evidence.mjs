import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const resolve = (...parts) => path.join(root, ...parts);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonLines(filePath) {
  const content = await readFile(filePath, "utf8");
  return content.trim().split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}

function assertMetric(metric, expectedTotal, label) {
  assert.equal(metric.total, expectedTotal, `${label}: tổng mẫu không đúng.`);
  assert.equal(typeof metric.correct, "number", `${label}: thiếu số mẫu đúng.`);
  assert(metric.correct >= 0 && metric.correct <= expectedTotal, `${label}: số mẫu đúng ngoài khoảng hợp lệ.`);
  assert.equal(typeof metric.accuracy, "number", `${label}: thiếu accuracy.`);
}

const prohibitedKeys = new Set([
  "audioPath",
  "audioBase64",
  "audio",
  "transcript",
  "transcription",
  "client_id",
  "gender",
  "speakerId",
  "rawInput",
  "rawResponse",
]);

function assertPublicArtifactIsSanitized(value, location = "root") {
  if (typeof value === "string") {
    assert(!value.includes("AIza"), `${location}: phát hiện chuỗi giống Gemini API key.`);
    assert(!value.includes("-----BEGIN"), `${location}: phát hiện private key.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublicArtifactIsSanitized(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert(!prohibitedKeys.has(key), `${location}: không được công bố trường ${key}.`);
    assertPublicArtifactIsSanitized(item, `${location}.${key}`);
  }
}

const textRows = await readJsonLines(resolve("evaluation", "datasets", "synthetic-text-v1.jsonl"));
assert.equal(textRows.length, 60, "Synthetic text evaluation phải có đúng 60 mẫu.");
assert(textRows.every((row) => row.source === "synthetic" && row.license === "project-authored"), "Mỗi text sample phải có source và license project-authored.");
assert(textRows.every((row) => Object.hasOwn(row, "expected")), "Mỗi text sample phải khóa expected trước khi gọi model.");

const inputs = textRows.map((row) => String(row.input).toLocaleLowerCase("vi-VN"));
const coverage = {
  sale: textRows.filter((row) => row.expected?.type === "sale").length,
  purchase: textRows.filter((row) => row.expected?.type === "purchase").length,
  expense: textRows.filter((row) => row.expected?.type === "expense").length,
  nonTransaction: textRows.filter((row) => row.expected === null).length,
  abbreviatedMoney: inputs.filter((input) => /nghìn|ngàn|\b\d+k\b/iu.test(input)).length,
  commonUnits: inputs.filter((input) => /ký|kg|chục/iu.test(input)).length,
  multiAction: inputs.filter((input) => (input.match(/\b(bán|nhập|mua|chi|trả)\b/giu) ?? []).length >= 2).length,
  missingFields: textRows.filter((row) => row.expected && Object.values(row.expected).some((value) => value === null)).length,
};
for (const [name, count] of Object.entries(coverage)) {
  assert(count > 0, `Synthetic text thiếu coverage: ${name}.`);
}

const textArtifact = await readJson(resolve("public", "evaluation", "text-latest.json"));
assert.notEqual(textArtifact.model, "fixture", "Không được dùng fixture làm báo cáo public.");
assert.equal(textArtifact.cases, 60, "Text artifact phải phản ánh đủ 60 mẫu.");
assert.equal(textArtifact.transactionCases + textArtifact.negativeCases, 60, "Text artifact có tổng phân loại sai.");
for (const field of ["type", "amount", "quantity", "unitPrice"]) {
  assertMetric(textArtifact.fields?.[field], textArtifact.transactionCases, `Text field ${field}`);
}
assertMetric(textArtifact.wholeTransaction, textArtifact.transactionCases, "Text exact transaction");
assertMetric(textArtifact.nonTransactionRejection, textArtifact.negativeCases, "Text non-transaction rejection");
assertPublicArtifactIsSanitized(textArtifact, "text-latest.json");

const fleursRows = await readJsonLines(resolve("evaluation", "manifests", "fleurs-vi-negative-clear-noisy.jsonl"));
assert.equal(fleursRows.length, 30, "FLEURS manifest phải có đúng 30 sample.");
assert(fleursRows.every((row) => row.source === "google-fleurs-vi-vn-validation" && row.license === "CC-BY-4.0" && row.expected === null), "Mỗi FLEURS sample phải có source, license và nhãn negative-control.");
assert.equal(fleursRows.filter((row) => row.condition === "clear").length, 15, "FLEURS clear phải có 15 sample.");
assert.equal(fleursRows.filter((row) => row.condition === "noisy").length, 15, "FLEURS noisy phải có 15 sample.");

const fleursArtifact = await readJson(resolve("public", "evaluation", "fleurs-vi-negative-clear-noisy-latest.json"));
assert.equal(fleursArtifact.dataset?.license, "CC-BY-4.0", "FLEURS artifact thiếu license.");
assert.equal(fleursArtifact.dataset?.caseCount, 30, "FLEURS artifact sai số sample.");
assertMetric(fleursArtifact.metrics?.nonTransactionRejection, 30, "FLEURS rejection");
assert.equal(fleursArtifact.metrics?.invalidJson?.total, 30, "FLEURS invalid JSON tổng mẫu không đúng.");
assertMetric(fleursArtifact.byCondition?.clear?.nonTransactionRejection, 15, "FLEURS clear rejection");
assertMetric(fleursArtifact.byCondition?.noisy?.nonTransactionRejection, 15, "FLEURS noisy rejection");
assertPublicArtifactIsSanitized(fleursArtifact, "fleurs-vi-negative-clear-noisy-latest.json");

const publicEvaluationFiles = (await readdir(resolve("public", "evaluation"))).filter((file) => file.endsWith(".json"));
for (const file of publicEvaluationFiles) {
  assertPublicArtifactIsSanitized(await readJson(resolve("public", "evaluation", file)), `public/evaluation/${file}`);
}

const protocol = await readFile(resolve("docs", "voice-benchmark-protocol.md"), "utf8");
assert(protocol.includes("does **not** measure market-transaction accuracy"), "Protocol phải công bố giới hạn benchmark voice.");

console.log(JSON.stringify({
  status: "passed",
  text: { cases: textRows.length, coverage, model: textArtifact.model, promptVersion: textArtifact.promptVersion },
  voiceNegativeControl: {
    cases: fleursRows.length,
    clear: fleursArtifact.byCondition.clear.nonTransactionRejection,
    noisy: fleursArtifact.byCondition.noisy.nonTransactionRejection,
  },
  publicArtifactsChecked: publicEvaluationFiles.length,
}, null, 2));
