import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, assertUniqueIds, loadEnvFile, positiveIntegerArgument, readJsonLines } from "./shared.mjs";
import { evaluationMarkdown, scoreEvaluation } from "./metrics.mjs";

const apiBase = "https://generativelanguage.googleapis.com/v1beta/models";
const promptVersion = "text-extraction-v2";
const prompt = `Bạn là bộ trích xuất giao dịch cho sổ thu chi của tiểu thương Việt Nam. Trả về đúng một JSON array có tối đa một giao dịch, không markdown. Chỉ trích xuất thông tin nói rõ trong câu; tuyệt đối không suy ra đơn giá bằng phép chia/nhân, thiếu đơn giá phải trả null. Chỉ tạo sale, purchase hoặc expense khi có hành động giao dịch và số tiền rõ ràng. amount và unitPrice là số nguyên VND. Nếu thiếu trường, dùng null. Nếu có nhiều giao dịch, chỉ lấy giao dịch đầu tiên. Nếu không có giao dịch, trả về [].`;
const schema = {
  type: "array", maxItems: 1,
  items: { type: "object", properties: {
    type: { type: "string", nullable: true, enum: ["sale", "purchase", "expense"] },
    quantity: { type: "number", nullable: true }, unitPrice: { type: "number", nullable: true }, amount: { type: "number", nullable: true },
    fieldsNeedingReview: { type: "array", items: { type: "string" } }, missingFields: { type: "array", items: { type: "string" } }, warnings: { type: "array", items: { type: "string" } },
  }, required: ["type", "quantity", "unitPrice", "amount", "fieldsNeedingReview", "missingFields", "warnings"] },
};

const manifestPath = path.resolve(argument("--manifest", "evaluation/datasets/synthetic-text-v1.jsonl"));
const outputPath = path.resolve(argument("--output", "evaluation/results/text-run.jsonl"));
const reportPath = path.resolve(argument("--report", "evaluation/results/text-report.json"));
const markdownPath = path.resolve(argument("--markdown", "evaluation/results/text-report.md"));
const fixturePath = argument("--fixture");
const limit = positiveIntegerArgument("--limit", "60");
await loadEnvFile();

const rows = await readJsonLines(manifestPath);
assertUniqueIds(rows);
if (rows.length > limit) throw new Error(`Manifest có ${rows.length} mẫu; --limit hiện tại là ${limit}.`);
const startedAt = new Date().toISOString();
let results;
if (fixturePath) {
  results = await readJsonLines(path.resolve(fixturePath));
  assertUniqueIds(results);
} else {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Thiếu GEMINI_API_KEY trong .env.local.");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  results = [];
  for (const row of rows) {
    const response = await fetch(`${apiBase}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\nCâu cần xử lý: ${row.input}` }] }], generationConfig: { response_mime_type: "application/json", response_schema: schema } }),
    });
    const body = await response.json().catch(() => null);
    const raw = body?.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text).filter((text) => typeof text === "string").join("") ?? "";
    let actual = null;
    let outcome = response.ok ? "valid" : "http-error";
    if (response.ok) {
      try { const parsed = JSON.parse(raw); actual = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null; } catch { outcome = "invalid-json"; }
    }
    results.push({ id: row.id, actual, outcome, httpStatus: response.status, error: response.ok ? null : body?.error?.message ?? "unknown" });
    console.log(`${row.id}: ${outcome}.`);
  }
}

const report = { dataset: path.relative(process.cwd(), manifestPath), model: fixturePath ? "fixture" : process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash", promptVersion, startedAt, completedAt: new Date().toISOString(), ...scoreEvaluation(rows, results) };
await mkdir(path.dirname(outputPath), { recursive: true });
await Promise.all([
  writeFile(outputPath, `${results.map((result) => JSON.stringify(result)).join("\n")}\n`, "utf8"),
  writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  writeFile(markdownPath, evaluationMarkdown(report), "utf8"),
]);
console.log(`Đã ghi ${results.length} kết quả, JSON report và Markdown report vào ${path.relative(process.cwd(), path.dirname(reportPath))}.`);
