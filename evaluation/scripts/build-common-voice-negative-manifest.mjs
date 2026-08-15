import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, positiveIntegerArgument } from "./shared.mjs";

const metadataPath = argument("--metadata");
const clipsDirectory = argument("--clips-dir");
const outputPath = path.resolve(argument("--output", "evaluation/manifests/common-voice-negative.jsonl"));
const limit = positiveIntegerArgument("--limit", "30");

if (!metadataPath || !clipsDirectory) {
  throw new Error(
    "Dùng: node evaluation/scripts/build-common-voice-negative-manifest.mjs --metadata <validated.tsv> --clips-dir <clips> [--limit 30]",
  );
}

const resolvedMetadata = path.resolve(metadataPath);
const resolvedClips = path.resolve(clipsDirectory);
await access(resolvedMetadata);
await access(resolvedClips);

function parseTsv(text) {
  const [headerLine, ...rows] = text.split(/\r?\n/u).filter(Boolean);
  const header = headerLine.split("\t");
  return rows.map((row) => Object.fromEntries(row.split("\t").map((value, index) => [header[index], value])));
}

function isNonTransactionSentence(sentence) {
  return !/(?:\bbán\b|\bnhập\b|\bmua\b|\bchi\b|\btrả\b|\bnghìn\b|\bngàn\b|\bđồng\b|\btriệu\b|\bgiá\b)/iu.test(sentence);
}

const records = parseTsv(await readFile(resolvedMetadata, "utf8"));
const manifest = [];

for (const record of records) {
  if (manifest.length >= limit) break;

  const sentence = record.sentence?.trim();
  const filename = record.path?.trim();
  if (!sentence || !filename || !isNonTransactionSentence(sentence)) continue;

  const safeFilename = path.basename(filename);
  if (safeFilename !== filename || !safeFilename.toLowerCase().endsWith(".mp3")) continue;

  const audioPath = path.join(resolvedClips, safeFilename);
  try {
    const file = await stat(audioPath);
    if (!file.isFile() || file.size === 0 || file.size > 5 * 1024 * 1024) continue;
  } catch {
    continue;
  }

  manifest.push({
    id: `common-voice-vi-negative-${String(manifest.length + 1).padStart(2, "0")}`,
    source: "mozilla-common-voice-scripted-speech-vi",
    license: "CC0-1.0",
    provenance: "Mozilla Data Collective – Common Voice Scripted Speech Vietnamese",
    input: sentence,
    audioPath,
    expected: null,
  });
}

if (manifest.length === 0) {
  throw new Error("Không tìm thấy clip Common Voice hợp lệ, không chứa tín hiệu giao dịch và nằm trong giới hạn 5 MB.");
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${manifest.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
console.log(`Đã tạo ${manifest.length} negative-control samples từ Common Voice. Không ghi client_id vào manifest.`);
