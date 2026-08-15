import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, assertUniqueIds, loadEnvFile, positiveIntegerArgument, readJsonLines } from "./shared.mjs";

const apiBase = "https://generativelanguage.googleapis.com/v1beta/interactions";
const manifestPath = path.resolve(argument("--manifest", "evaluation/manifests/synthetic-tts.jsonl"));
const limit = positiveIntegerArgument("--limit", "30");
const force = process.argv.includes("--force");
await loadEnvFile();

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) throw new Error("Thiếu GEMINI_API_KEY trong môi trường hoặc .env.local.");
const model = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-2.5-flash-preview-tts";
const voice = process.env.GEMINI_TTS_VOICE?.trim() || "Kore";
const rows = await readJsonLines(manifestPath);
assertUniqueIds(rows);
const selectedRows = rows.slice(0, limit);
if (selectedRows.length === 0) throw new Error("Manifest không có mẫu TTS nào để tạo.");

function audioData(response) {
  if (typeof response?.output_audio?.data === "string") return response.output_audio.data;
  if (typeof response?.outputAudio?.data === "string") return response.outputAudio.data;
  for (const step of response?.steps ?? []) {
    for (const part of step?.content ?? []) {
      if (part?.type === "audio" && typeof part.data === "string") return part.data;
    }
  }
  return null;
}

function wavFromPcm(pcm, sampleRate = 24_000) {
  const header = Buffer.alloc(44);
  const channels = 1;
  const sampleWidth = 2;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * sampleWidth, 28);
  header.writeUInt16LE(channels * sampleWidth, 32);
  header.writeUInt16LE(sampleWidth * 8, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

for (const row of selectedRows) {
  if (typeof row.input !== "string" || !row.audioPath) throw new Error(`${row.id}: thiếu input hoặc audioPath.`);
  const outputPath = path.resolve(path.dirname(manifestPath), row.audioPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (!force) {
    try { await readFile(outputPath); console.log(`${row.id}: bỏ qua vì audio đã tồn tại.`); continue; } catch {}
  }

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      input: `Đọc tự nhiên bằng tiếng Việt, tốc độ hội thoại bình thường. Chỉ đọc nguyên văn câu sau, không thêm lời dẫn: ${row.input}`,
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${row.id}: Gemini TTS trả HTTP ${response.status}: ${body?.error?.message ?? "unknown"}`);
  }
  const data = audioData(body);
  if (!data) throw new Error(`${row.id}: Gemini TTS không trả audio. Hãy kiểm tra model, quota hoặc policy của API.`);
  const pcm = Buffer.from(data, "base64");
  if (pcm.length === 0) throw new Error(`${row.id}: Gemini TTS trả audio rỗng.`);
  await writeFile(outputPath, wavFromPcm(pcm));
  console.log(`${row.id}: đã tạo ${path.relative(process.cwd(), outputPath)}.`);
}

console.log(`Hoàn tất ${selectedRows.length} mẫu bằng ${model}, giọng ${voice}.`);
