export type EvaluationField = "type" | "amount" | "quantity" | "unitPrice";

export type EvaluationMetric = { correct: number; total: number; accuracy: number | null };
export type EvaluationSample = {
  id: string;
  input: string;
  expected: Partial<Record<EvaluationField, string | number | null>> | null;
  actual: Partial<Record<EvaluationField, string | number | null>> | null;
  note: string;
};

export type LatestEvaluationReport = {
  model: string;
  promptVersion: string;
  completedAt: string;
  cases: number;
  transactionCases: number;
  negativeCases: number;
  fields: Record<EvaluationField, EvaluationMetric>;
  wholeTransaction: EvaluationMetric;
  nonTransactionRejection: EvaluationMetric;
  invalidJson: { count: number; total: number; rate: number | null };
  requiresHumanReview: { count: number; total: number; rate: number | null };
  errorGroups: Record<string, number>;
  examples?: { correct: EvaluationSample; incorrect: EvaluationSample; validationDetected: EvaluationSample };
};

const fieldNames: EvaluationField[] = ["type", "amount", "quantity", "unitPrice"];

function numberOrNull(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }

function metric(value: unknown): EvaluationMetric | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const correct = numberOrNull(candidate.correct);
  const total = numberOrNull(candidate.total);
  const accuracy = candidate.accuracy === null ? null : numberOrNull(candidate.accuracy);
  if (correct === null || total === null || accuracy === null && candidate.accuracy !== null) return null;
  return { correct, total, accuracy };
}

function sample(value: unknown): EvaluationSample | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.input !== "string" || typeof candidate.note !== "string") return null;
  const record = (part: unknown) => part === null || part && typeof part === "object" ? part as EvaluationSample["expected"] : null;
  const expected = record(candidate.expected);
  const actual = record(candidate.actual);
  if (expected === undefined || actual === undefined) return null;
  return { id: candidate.id, input: candidate.input, expected, actual, note: candidate.note };
}

export function parseLatestEvaluationReport(value: unknown): LatestEvaluationReport | null {
  if (!value || typeof value !== "object") return null;
  const report = value as Record<string, unknown>;
  const fieldsValue = report.fields;
  if (!fieldsValue || typeof fieldsValue !== "object") return null;
  const fields = {} as Record<EvaluationField, EvaluationMetric>;
  for (const field of fieldNames) {
    const parsed = metric((fieldsValue as Record<string, unknown>)[field]);
    if (!parsed) return null;
    fields[field] = parsed;
  }
  const wholeTransaction = metric(report.wholeTransaction);
  const nonTransactionRejection = metric(report.nonTransactionRejection);
  const invalidJson = report.invalidJson as Record<string, unknown> | undefined;
  const requiresHumanReview = report.requiresHumanReview as Record<string, unknown> | undefined;
  const primitiveValues = ["model", "promptVersion", "completedAt"].every((key) => typeof report[key] === "string");
  const counts = ["cases", "transactionCases", "negativeCases"].every((key) => numberOrNull(report[key]) !== null);
  const invalidJsonRate = invalidJson?.rate === null ? null : numberOrNull(invalidJson?.rate);
  const reviewRate = requiresHumanReview?.rate === null ? null : numberOrNull(requiresHumanReview?.rate);
  if (!primitiveValues || !counts || !wholeTransaction || !nonTransactionRejection || !invalidJson || !requiresHumanReview || invalidJsonRate === null && invalidJson.rate !== null || reviewRate === null && requiresHumanReview.rate !== null) return null;
  const examplesValue = report.examples as Record<string, unknown> | undefined;
  const examples = examplesValue ? {
    correct: sample(examplesValue.correct), incorrect: sample(examplesValue.incorrect), validationDetected: sample(examplesValue.validationDetected),
  } : undefined;
  if (examples && (!examples.correct || !examples.incorrect || !examples.validationDetected)) return null;
  return {
    model: report.model as string, promptVersion: report.promptVersion as string, completedAt: report.completedAt as string,
    cases: report.cases as number, transactionCases: report.transactionCases as number, negativeCases: report.negativeCases as number,
    fields, wholeTransaction, nonTransactionRejection,
    invalidJson: { count: numberOrNull(invalidJson.count) ?? 0, total: numberOrNull(invalidJson.total) ?? 0, rate: invalidJsonRate },
    requiresHumanReview: { count: numberOrNull(requiresHumanReview.count) ?? 0, total: numberOrNull(requiresHumanReview.total) ?? 0, rate: reviewRate },
    errorGroups: Object.fromEntries(Object.entries(report.errorGroups ?? {}).filter(([, count]) => typeof count === "number")),
    examples: examples as LatestEvaluationReport["examples"],
  };
}

export function formatEvaluationPercent(value: number | null): string { return value === null ? "—" : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`; }
