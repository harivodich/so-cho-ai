export const MAX_ANALYSIS_ATTEMPTS_PER_RECORDING = 2;

export function canAnalyzeRecording(attemptCount: number): boolean {
  return Number.isSafeInteger(attemptCount) && attemptCount >= 0 && attemptCount < MAX_ANALYSIS_ATTEMPTS_PER_RECORDING;
}

export function remainingAnalysisAttempts(attemptCount: number): number {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 0) return 0;
  return Math.max(0, MAX_ANALYSIS_ATTEMPTS_PER_RECORDING - attemptCount);
}
