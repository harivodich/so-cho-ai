import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("voice benchmark data contract", () => {
  it("documents public-data provenance and does not overclaim transaction accuracy", async () => {
    const root = process.cwd();
    const manifest = JSON.parse(await readFile(resolve(root, "evaluation/dataset-manifest.json"), "utf8"));
    const fleurs = manifest.datasets.find((dataset: { id: string }) => dataset.id === "google-fleurs-vi-vn-validation");
    const fleursClearNoisy = manifest.datasets.find((dataset: { id: string }) => dataset.id === "google-fleurs-vi-vn-clear-noisy-negative-v1");
    const syntheticTts = manifest.datasets.find((dataset: { id: string }) => dataset.id === "synthetic-tts-v1");
    const protocol = await readFile(resolve(root, "docs/voice-benchmark-protocol.md"), "utf8");
    const downloader = await readFile(resolve(root, "evaluation/scripts/download-fleurs-vi-negative.mjs"), "utf8");

    expect(fleurs).toMatchObject({ license: "CC-BY-4.0", caseCount: 30, kind: "public-audio-negative-control" });
    expect(fleursClearNoisy).toMatchObject({ license: "CC-BY-4.0", caseCount: 30, kind: "public-audio-negative-control" });
    expect(syntheticTts).toMatchObject({ caseCount: 30 });
    expect(protocol).toContain("does **not** measure market-transaction accuracy");
    expect(protocol).toContain("29/30");
    expect(downloader).toContain("Không ghi gender, id người nói hoặc metadata cá nhân");
    expect(downloader).not.toContain("row.gender");
  });
});
