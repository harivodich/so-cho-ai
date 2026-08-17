import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type OcrFixture = {
  id: string;
  image: string;
  expectedDrafts: Array<{ type: string; amount: number | null }>;
  quality: string;
  notes: string;
};

function loadFixtures(fileName: string): OcrFixture[] {
  const file = resolve(process.cwd(), `evaluation/fixtures/${fileName}`);
  return readFileSync(file, "utf8").trim().split(/\r?\n/u).map((line) => JSON.parse(line) as OcrFixture);
}

describe("synthetic OCR benchmark contract", () => {
  it("keeps at least 15 public, no-PII fixtures with explicit quality labels", () => {
    const fixtures = loadFixtures("ocr-printed-invoice.jsonl");
    expect(fixtures).toHaveLength(15);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(15);
    expect(fixtures.every((fixture) => fixture.image.startsWith("ocr-images/") && fixture.notes.includes("no user"))).toBe(true);
    expect(fixtures.filter((fixture) => fixture.quality === "clear").length).toBeGreaterThanOrEqual(10);
    expect(fixtures.some((fixture) => fixture.quality === "handwritten")).toBe(true);
    expect(fixtures.some((fixture) => fixture.quality === "blurred")).toBe(true);
  });

  it("keeps a rasterized manifest that the image API can accept", () => {
    const fixtures = loadFixtures("ocr-printed-invoice-png.jsonl");
    expect(fixtures).toHaveLength(15);
    expect(fixtures.every((fixture) => fixture.image.startsWith("ocr-png/") && fixture.image.endsWith(".png"))).toBe(true);
  });

  it("exposes a runner and scorer without embedding credentials", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(packageJson.scripts["eval:ocr"]).toContain("run-ocr-eval.mjs");
    expect(packageJson.scripts["score:ocr"]).toContain("score-ocr-results.mjs");
    const runner = readFileSync(resolve(process.cwd(), "evaluation/scripts/run-ocr-eval.mjs"), "utf8");
    expect(runner).toContain("OCR_EVAL_ID_TOKEN");
    expect(runner).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/u);
  });

  it("encodes the 80% clear-printed release threshold in the scorer", () => {
    const scorer = readFileSync(resolve(process.cwd(), "evaluation/scripts/score-ocr-results.mjs"), "utf8");
    expect(scorer).toContain("MIN_CLEAR_PRINTED_ACCURACY = 80");
    expect(scorer).toContain('from "node:fs/promises"');
    expect(scorer).toContain("minimumClearPrintedAccuracy");
    expect(scorer).toContain("clearPrintedAccuracy");
    expect(scorer).toContain("report.releaseGate.passed");
  });
});