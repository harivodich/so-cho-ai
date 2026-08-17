import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, assertUniqueIds, positiveIntegerArgument, readJsonLines } from "./shared.mjs";

const manifestPath = path.resolve(argument("--manifest", "evaluation/fixtures/ocr-printed-invoice-png.jsonl"));
const outputPath = path.resolve(argument("--output", "evaluation/results/ocr-run.jsonl"));
const baseUrl = argument("--base-url", "http://127.0.0.1:3102").replace(/\/$/u, "");
const limit = positiveIntegerArgument("--limit", "15");
const token = process.env.OCR_EVAL_ID_TOKEN?.trim();
if (!token) {
  throw new Error("Thiếu OCR_EVAL_ID_TOKEN. Hãy dùng ID token của tài khoản thật; không dùng tài khoản anonymous.");
}

const rows = await readJsonLines(manifestPath);
assertUniqueIds(rows);
if (rows.length > limit) throw new Error(`Manifest có ${rows.length} mẫu; --limit hiện tại là ${limit}.`);
const results = [];
for (const row of rows) {
  const imagePath = path.resolve(path.dirname(manifestPath), row.image);
  const image = await readFile(imagePath);
  const metadata = await stat(imagePath);
  if (metadata.size <= 0 || metadata.size > 5 * 1024 * 1024) throw new Error(`${row.id}: ảnh phải >0 và <=5 MB.`);
  const extension = path.extname(imagePath).toLowerCase();
  const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : extension === ".webp" ? "image/webp" : extension === ".png" ? "image/png" : null;
  if (!mime) throw new Error(`${row.id}: chỉ hỗ trợ JPG, PNG hoặc WebP.`);
  const form = new FormData();
  form.append("mode", "image");
  form.append("image", new Blob([image], { type: mime }), path.basename(imagePath));
  const response = await fetch(`${baseUrl}/api/extract`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json().catch(() => null);
  const drafts = Array.isArray(body?.drafts) ? body.drafts.map((draft) => ({
    type: draft?.type ?? null,
    itemName: draft?.itemName ?? null,
    canonicalItemName: draft?.canonicalItemName ?? null,
    quantity: draft?.quantity ?? null,
    unit: draft?.unit ?? null,
    unitPrice: draft?.unitPrice ?? null,
    amount: draft?.amount ?? null,
    occurredAt: draft?.occurredAt ?? null,
    fieldsNeedingReview: Array.isArray(draft?.fieldsNeedingReview) ? draft.fieldsNeedingReview : [],
    missingFields: Array.isArray(draft?.missingFields) ? draft.missingFields : [],
  })) : [];
  const outcome = response.ok ? "valid" : "http-error";
  results.push({ id: row.id, actualDrafts: drafts, outcome, httpStatus: response.status, error: response.ok ? null : body?.error ?? "unknown" });
  console.log(`${row.id}: ${outcome} (${response.status}).`);
}
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${results.map((result) => JSON.stringify(result)).join("\n")}\n`, "utf8");
console.log(`Đã ghi ${results.length} kết quả vào ${path.relative(process.cwd(), outputPath)}.`);