import { describe, expect, it } from "vitest";

import {
  MAX_ANALYSIS_ATTEMPTS_PER_RECORDING,
  canAnalyzeRecording,
  remainingAnalysisAttempts,
} from "@/lib/extraction/retry-policy";

describe("voice analysis retry policy", () => {
  it("allows the initial request and exactly one manual retry", () => {
    expect(MAX_ANALYSIS_ATTEMPTS_PER_RECORDING).toBe(2);
    expect(canAnalyzeRecording(0)).toBe(true);
    expect(remainingAnalysisAttempts(0)).toBe(2);
    expect(canAnalyzeRecording(1)).toBe(true);
    expect(remainingAnalysisAttempts(1)).toBe(1);
    expect(canAnalyzeRecording(2)).toBe(false);
    expect(remainingAnalysisAttempts(2)).toBe(0);
  });

  it("fails closed for malformed attempt counts", () => {
    expect(canAnalyzeRecording(-1)).toBe(false);
    expect(canAnalyzeRecording(1.5)).toBe(false);
    expect(remainingAnalysisAttempts(Number.NaN)).toBe(0);
  });
});
