import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseLatestEvaluationReport } from "@/lib/evaluation/latest-report";

describe("public Evaluation Lab artifact", () => {
  it("is parseable, has three transparent examples, and contains no API key marker", async () => {
    const artifact = await readFile(resolve(process.cwd(), "public/evaluation/text-latest.json"), "utf8");
    const report = parseLatestEvaluationReport(JSON.parse(artifact));

    expect(artifact).not.toContain("AIza");
    expect(artifact).not.toContain("fixture");
    expect(report).not.toBeNull();
    expect(report?.cases).toBe(60);
    expect(report?.examples).toEqual(
      expect.objectContaining({
        correct: expect.objectContaining({ id: expect.any(String) }),
        incorrect: expect.objectContaining({ id: expect.any(String) }),
        validationDetected: expect.objectContaining({ id: expect.any(String) }),
      }),
    );
  });
});
