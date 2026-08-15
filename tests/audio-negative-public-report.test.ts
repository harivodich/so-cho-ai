import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("public audio negative-control artifact", () => {
  it("publishes metrics and provenance without audio, transcript, speaker metadata, or API keys", async () => {
    const artifact = await readFile(resolve(process.cwd(), "public/evaluation/fleurs-vi-negative-clear-noisy-latest.json"), "utf8");
    const report = JSON.parse(artifact);

    expect(report).toMatchObject({
      dataset: { id: "google-fleurs-vi-vn-validation", license: "CC-BY-4.0", caseCount: 30 },
      metrics: { nonTransactionRejection: { correct: 29, total: 30, accuracy: 96.67 } },
      byCondition: {
        clear: { nonTransactionRejection: { correct: 14, total: 15, accuracy: 93.33 } },
        noisy: { nonTransactionRejection: { correct: 15, total: 15, accuracy: 100 } },
      },
      scope: expect.stringContaining("not transaction extraction accuracy"),
    });
    expect(artifact).not.toContain("audioPath");
    expect(artifact).not.toContain("transcription");
    expect(artifact).not.toContain("gender");
    expect(artifact).not.toContain("AIza");
  });
});
