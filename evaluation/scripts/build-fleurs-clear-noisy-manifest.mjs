import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { argument, assertUniqueIds, positiveIntegerArgument, readJsonLines, resolvedInputPath } from "./shared.mjs";
import { addDeterministicWhiteNoise } from "./wav-noise.mjs";

const sourceManifestPath = path.resolve(argument("--source", "evaluation/manifests/fleurs-vi-negative.jsonl"));
const outputManifestPath = path.resolve(argument("--output", "evaluation/manifests/fleurs-vi-negative-clear-noisy.jsonl"));
const noisyDirectory = path.resolve(argument("--noisy-directory", "evaluation/inputs/fleurs-vi-negative/noisy"));
const pairs = positiveIntegerArgument("--pairs", "15");
const snrDb = Number(argument("--snr-db", "20"));
if (!Number.isFinite(snrDb) || snrDb <= 0 || snrDb > 60) throw new Error("--snr-db phải nằm trong khoảng (0, 60].");

const sourceRows = await readJsonLines(sourceManifestPath);
assertUniqueIds(sourceRows);
if (sourceRows.length < pairs || sourceRows.some((row) => row.expected !== null)) {
  throw new Error("Manifest nguồn phải có đủ public negative-control samples với expected: null.");
}

await mkdir(noisyDirectory, { recursive: true });
const rows = [];
for (const [index, source] of sourceRows.slice(0, pairs).entries()) {
  const number = String(index + 1).padStart(2, "0");
  const sourceAudioPath = resolvedInputPath(source, sourceManifestPath);
  const noisyFileName = `fleurs-vi-negative-${number}-snr-${snrDb}.wav`;
  const noisyPath = path.join(noisyDirectory, noisyFileName);
  const seed = 20_260_814 + index;
  const noisyAudio = addDeterministicWhiteNoise(await readFile(sourceAudioPath), { seed, snrDb });
  await writeFile(noisyPath, noisyAudio);
  const relativeOriginal = path.relative(path.dirname(outputManifestPath), sourceAudioPath).split(path.sep).join("/");
  const relativeNoisy = path.relative(path.dirname(outputManifestPath), noisyPath).split(path.sep).join("/");
  const common = {
    source: source.source,
    license: source.license,
    provenance: source.provenance,
    input: source.input,
    expected: null,
  };
  rows.push({ id: `fleurs-vi-clear-${number}`, ...common, condition: "clear", audioPath: relativeOriginal });
  rows.push({ id: `fleurs-vi-noisy-${number}`, ...common, condition: "noisy", audioPath: relativeNoisy, noise: { kind: "deterministic-white-noise", snrDb, seed } });
}
assertUniqueIds(rows);
await mkdir(path.dirname(outputManifestPath), { recursive: true });
await writeFile(outputManifestPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
console.log(`Created ${rows.length} paired FLEURS samples (${pairs} clear, ${pairs} noisy at ${snrDb} dB SNR).`);
