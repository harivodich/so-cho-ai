import { readFile } from "node:fs/promises";
import path from "node:path";

export function argument(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

export function positiveIntegerArgument(flag, fallback) {
  const value = Number(argument(flag, fallback));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${flag} phải là số nguyên dương.`);
  return value;
}

export async function loadEnvFile(filePath = ".env.local") {
  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || match[2] === "") continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] ??= value;
  }
}

export async function readJsonLines(filePath) {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`${filePath}: dòng ${index + 1} không phải JSON hợp lệ.`);
      }
    });
}

export function assertUniqueIds(rows) {
  const ids = new Set();
  for (const row of rows) {
    if (typeof row?.id !== "string" || !row.id.trim() || ids.has(row.id)) {
      throw new Error("Manifest phải có id không rỗng và không trùng.");
    }
    ids.add(row.id);
  }
}

export function resolvedInputPath(row, manifestPath, audioRoot) {
  const candidate = row.audioPath
    ? path.resolve(path.dirname(manifestPath), row.audioPath)
    : row.sourcePath && audioRoot
      ? path.resolve(audioRoot, row.sourcePath)
      : null;
  if (!candidate) throw new Error(`${row.id}: thiếu audioPath hoặc sourcePath + --audio-root.`);
  return candidate;
}

export function mimeTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".m4a": "audio/m4a",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
  };
  const mimeType = types[extension];
  if (!mimeType) throw new Error(`Định dạng ${extension || "không rõ"} chưa được hỗ trợ.`);
  return mimeType;
}
