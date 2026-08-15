const scoredFields = ["type", "amount", "quantity", "unitPrice"];

const percent = (correct, total) => total === 0 ? null : Number(((correct / total) * 100).toFixed(2));

export function scoreEvaluation(expectedRows, actualRows) {
  const expectedById = new Map(expectedRows.map((row) => [row.id, row.expected]));
  const actualById = new Map(actualRows.map((row) => [row.id, row]));
  if (actualById.size !== expectedById.size || [...expectedById.keys()].some((id) => !actualById.has(id))) {
    throw new Error("Kết quả evaluation phải có đúng một kết quả cho mỗi mẫu trong manifest.");
  }

  const transactionRows = expectedRows.filter((row) => row.expected !== null);
  const negativeRows = expectedRows.filter((row) => row.expected === null);
  const fields = Object.fromEntries(scoredFields.map((field) => [field, { correct: 0, total: transactionRows.length }]));
  const errorGroups = new Map();
  let wholeTransactionCorrect = 0;
  let requiresHumanReview = 0;
  let invalidJson = 0;

  for (const row of expectedRows) {
    const result = actualById.get(row.id);
    if (result?.outcome === "invalid-json") invalidJson += 1;
  }

  for (const row of transactionRows) {
    const result = actualById.get(row.id);
    const actual = result?.actual ?? null;
    const mismatches = scoredFields.filter((field) => {
      const matches = (row.expected?.[field] ?? null) === (actual?.[field] ?? null);
      if (matches) fields[field].correct += 1;
      return !matches;
    });
    if (mismatches.length === 0 && result?.outcome === "valid") wholeTransactionCorrect += 1;

    const modelReview = Boolean(actual?.fieldsNeedingReview?.length || actual?.missingFields?.length || actual?.warnings?.length);
    if (mismatches.length || modelReview || result?.outcome !== "valid") requiresHumanReview += 1;
    for (const field of mismatches) errorGroups.set(`field:${field}`, (errorGroups.get(`field:${field}`) ?? 0) + 1);
    if (result?.outcome && result.outcome !== "valid") errorGroups.set(result.outcome, (errorGroups.get(result.outcome) ?? 0) + 1);
  }

  const negativeCorrect = negativeRows.filter((row) => {
    const result = actualById.get(row.id);
    return result?.outcome === "valid" && result.actual === null;
  }).length;
  for (const row of negativeRows) {
    const result = actualById.get(row.id);
    if (result?.outcome && result.outcome !== "valid") errorGroups.set(result.outcome, (errorGroups.get(result.outcome) ?? 0) + 1);
  }

  return {
    cases: expectedRows.length,
    transactionCases: transactionRows.length,
    negativeCases: negativeRows.length,
    fields: Object.fromEntries(scoredFields.map((field) => [field, { ...fields[field], accuracy: percent(fields[field].correct, fields[field].total) }])),
    wholeTransaction: { correct: wholeTransactionCorrect, total: transactionRows.length, accuracy: percent(wholeTransactionCorrect, transactionRows.length) },
    nonTransactionRejection: { correct: negativeCorrect, total: negativeRows.length, accuracy: percent(negativeCorrect, negativeRows.length) },
    invalidJson: { count: invalidJson, total: expectedRows.length, rate: percent(invalidJson, expectedRows.length) },
    requiresHumanReview: { count: requiresHumanReview, total: transactionRows.length, rate: percent(requiresHumanReview, transactionRows.length) },
    errorGroups: Object.fromEntries([...errorGroups.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}

function conditionOf(row) {
  return typeof row.condition === "string" && row.condition.trim() ? row.condition.trim() : "unspecified";
}

export function scoreByCondition(expectedRows, actualRows) {
  const actualById = new Map(actualRows.map((row) => [row.id, row]));
  const conditions = new Map();

  for (const row of expectedRows) {
    const condition = conditionOf(row);
    const group = conditions.get(condition) ?? [];
    group.push(row);
    conditions.set(condition, group);
  }

  return Object.fromEntries(
    [...conditions.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([condition, rows]) => [
      condition,
      scoreEvaluation(rows, rows.map((row) => actualById.get(row.id))),
    ]),
  );
}

function summaryMarkdown(report) {
  const metricRows = Object.entries(report.fields).map(([field, value]) => `| ${field} | ${value.correct}/${value.total} | ${value.accuracy ?? "—"}% |`).join("\n");
  const errors = Object.entries(report.errorGroups).map(([group, count]) => `- ${group}: ${count}`).join("\n") || "- Không có lỗi được phân nhóm.";
  return `- Tổng mẫu: ${report.cases}\n- Mẫu giao dịch: ${report.transactionCases}\n- Mẫu ngoài phạm vi: ${report.negativeCases}\n- Exact transaction accuracy: ${report.wholeTransaction.accuracy ?? "—"}%\n- Tỷ lệ cần người kiểm tra/sửa: ${report.requiresHumanReview.rate ?? "—"}%\n- Tỷ lệ JSON không hợp lệ: ${report.invalidJson.rate ?? "—"}%\n\n| Trường | Đúng/Tổng | Accuracy |\n| --- | ---: | ---: |\n${metricRows}\n\n## Nhóm lỗi\n\n${errors}`;
}

export function evaluationMarkdown(report) {
  const conditions = Object.entries(report.byCondition ?? {});
  const conditionSections = conditions.length === 0
    ? ""
    : `\n\n## Theo điều kiện audio\n\n${conditions.map(([condition, value]) => `### ${condition}\n\n${summaryMarkdown(value)}`).join("\n\n")}`;
  return `# Kết quả Evaluation\n\n${summaryMarkdown(report)}${conditionSections}\n`;
}
