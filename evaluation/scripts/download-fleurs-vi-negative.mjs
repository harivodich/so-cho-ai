import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, positiveIntegerArgument } from "./shared.mjs";

const DATASET = "google/fleurs";
const CONFIG = "vi_vn";
const SPLIT = "validation";
const DATASET_LICENSE = "CC-BY-4.0";
const MAX_ROWS_PER_REQUEST = 100;
const outputDirectory = path.resolve(argument("--output-dir", "evaluation/inputs/fleurs-vi-negative/clips"));
const manifestPath = path.resolve(argument("--manifest", "evaluation/manifests/fleurs-vi-negative.jsonl"));
const limit = positiveIntegerArgument("--limit", "30");
const scanLimit = positiveIntegerArgument("--scan-limit", "198");

function isNonTransactionSentence(sentence) {
  return !/(?:\bbán\b|\bnhập\b|\bmua\b|\bchi\b|\btrả\b|\bnghìn\b|\bngàn\b|\bđồng\b|\btriệu\b|\bgiá\b)/iu.test(sentence);
}

async function rowsAt(offset, length) {
  const params = new URLSearchParams({ dataset: DATASET, config: CONFIG, split: SPLIT, offset: String(offset), length: String(length) });
  const response = await fetch(`https://datasets-server.huggingface.co/rows?${params}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`FLEURS rows API trả HTTP ${response.status}.`);
  const payload = await response.json();
  return Array.isArray(payload.rows) ? payload.rows : [];
}

async function scannedRows(count) {
  const rows = [];
  for (let offset = 0; offset < count; offset += MAX_ROWS_PER_REQUEST) {
    const batch = await rowsAt(offset, Math.min(MAX_ROWS_PER_REQUEST, count - offset));
    rows.push(...batch);
    if (batch.length < MAX_ROWS_PER_REQUEST) break;
  }
  return rows;
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(path.dirname(manifestPath), { recursive: true });

const candidates = await scannedRows(scanLimit);
const manifest = [];

for (const candidate of candidates) {
  if (manifest.length >= limit) break;

  const row = candidate?.row;
  const sentence = typeof row?.transcription === "string" ? row.transcription.trim() : "";
  const audio = Array.isArray(row?.audio) ? row.audio[0] : null;
  if (!sentence || !isNonTransactionSentence(sentence) || typeof audio?.src !== "string" || audio.type !== "audio/wav") continue;

  const id = `fleurs-vi-negative-${String(manifest.length + 1).padStart(2, "0")}`;
  const filename = `${id}.wav`;
  const target = path.join(outputDirectory, filename);
  const audioResponse = await fetch(audio.src, { signal: AbortSignal.timeout(60_000) });
  if (!audioResponse.ok) throw new Error(`${id}: không tải được audio, HTTP ${audioResponse.status}.`);
  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  if (audioBuffer.length === 0 || audioBuffer.length > 5 * 1024 * 1024) continue;

  await writeFile(target, audioBuffer);
  manifest.push({
    id,
    source: "google-fleurs-vi-vn-validation",
    license: DATASET_LICENSE,
    provenance: "Google FLEURS vi_vn validation via Hugging Face datasets-server",
    condition: "public-unrated",
    input: sentence,
    audioPath: path.relative(path.dirname(manifestPath), target).replaceAll("\\", "/"),
    expected: null,
  });
  console.log(`${id}: saved ${audioBuffer.length} bytes.`);
}

if (manifest.length < limit) {
  throw new Error(`Chỉ tìm được ${manifest.length}/${limit} clip hợp lệ. Tăng --scan-limit nếu FLEURS thay đổi.`);
}

await writeFile(manifestPath, `${manifest.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
console.log(`Đã tạo ${manifest.length} FLEURS Vietnamese negative-control samples. Không ghi gender, id người nói hoặc metadata cá nhân.`);
