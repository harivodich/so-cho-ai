import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, assertUniqueIds, loadEnvFile, mimeTypeFor, positiveIntegerArgument, readJsonLines, resolvedInputPath } from "./shared.mjs";

const manifestPath = path.resolve(argument("--manifest", "evaluation/manifests/synthetic-tts.jsonl"));
const outputPath = path.resolve(argument("--output", "evaluation/results/audio-run.jsonl"));
const baseUrl = argument("--base-url", "http://127.0.0.1:3102").replace(/\/$/u, "");
const audioRoot = argument("--audio-root");
const limit = positiveIntegerArgument("--limit", "30");
await loadEnvFile();

const idToken = process.env.VOICE_EVAL_ID_TOKEN?.trim();
if (!idToken) throw new Error("Thiếu VOICE_EVAL_ID_TOKEN. Hãy dùng ID token của tài khoản thật; không dùng anonymous.");
const rows = await readJsonLines(manifestPath);
assertUniqueIds(rows);
const selectedRows = rows.slice(0, limit);
if (selectedRows.length === 0) throw new Error("Manifest không có audio để đánh giá.");

const results = [];
for (const row of selectedRows) {
  const audioPath = resolvedInputPath(row, manifestPath, audioRoot);
  const fileInfo = await stat(audioPath);
  if (fileInfo.size === 0 || fileInfo.size > 5 * 1024 * 1024) throw new Error(`${row.id}: audio phải từ 1 byte đến 5 MB.`);
  const mimeType = mimeTypeFor(audioPath);
  const formData = new FormData();
  formData.set("mode", "voice");
  formData.set("audio", new Blob([await readFile(audioPath)], { type: mimeType }), path.basename(audioPath));

  const response = await fetch(`${baseUrl}/api/extract`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
    signal: AbortSignal.timeout(35_000),
  });
  const payload = await response.json().catch(() => ({}));
  const actual = Array.isArray(payload.drafts) && payload.drafts.length === 1 ? payload.drafts[0] : null;
  results.push({ id: row.id, actual, outcome: response.ok ? "valid" : "http-error", httpStatus: response.status, error: response.ok ? null : payload.error ?? "unknown" });
  console.log(`${row.id}: HTTP ${response.status}, ${actual ? "có giao dịch" : "không có giao dịch"}.`);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${results.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
console.log(`Đã ghi ${results.length} kết quả vào ${path.relative(process.cwd(), outputPath)}.`);