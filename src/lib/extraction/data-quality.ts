import type { ConfirmedTransaction, TransactionDraft } from "@/types/transaction";

export type DataQualityCheck = {
  field: "amount" | "occurredAt" | "type" | "transactionCount";
  value: string;
  reason: string;
  action: string;
};

type Context = { currentDate: string; history?: Pick<ConfirmedTransaction, "amount" | "type" | "canonicalItemName">[] };

function addCheck(draft: TransactionDraft, check: DataQualityCheck): TransactionDraft {
  const warning = `${check.reason} ${check.action}`;
  return {
    ...draft,
    fieldsNeedingReview: [...new Set([...draft.fieldsNeedingReview, check.field])],
    warnings: [...new Set([...draft.warnings, warning])],
    qualityChecks: [...draft.qualityChecks, check],
  };
}

function addMissingCheck(draft: TransactionDraft, check: DataQualityCheck): TransactionDraft {
  return addCheck({ ...draft, missingFields: [...new Set([...draft.missingFields, check.field])] }, check);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function hasMultipleTransactionSignals(rawInput: string): boolean {
  const actions = rawInput.match(/\b(bán|nhập|mua|chi|trả)\b/giu) ?? [];
  return actions.length >= 2;
}

export function applyDataQualityGuard(draft: TransactionDraft, context: Context): TransactionDraft {
  let result = { ...draft, qualityChecks: [...draft.qualityChecks] };
  if (!result.type) {
    result = addMissingCheck(result, { field: "type", value: "null", reason: "Chưa nhận diện được loại giao dịch.", action: "Chọn Bán, Nhập hoặc Chi phí trước khi lưu." });
  }
  if (result.amount === null) {
    result = addMissingCheck(result, { field: "amount", value: "null", reason: "Chưa nhận diện được tổng tiền.", action: "Nhập tổng tiền trước khi lưu." });
  } else if (!Number.isSafeInteger(result.amount) || result.amount <= 0) {
    result = addCheck(result, { field: "amount", value: String(result.amount), reason: "Tổng tiền không phải số nguyên VND hợp lệ.", action: "Sửa tổng tiền trước khi lưu." });
  }
  if (result.occurredAt && result.occurredAt > context.currentDate) {
    result = addCheck(result, { field: "occurredAt", value: result.occurredAt, reason: "Ngày giao dịch nằm trong tương lai.", action: "Kiểm tra và chọn lại ngày." });
  }
  if (result.quantity !== null && result.unitPrice !== null && result.amount !== null) {
    const calculatedAmount = Math.round(result.quantity * result.unitPrice);
    if (calculatedAmount !== result.amount) {
      result = addCheck(result, { field: "amount", value: String(result.amount), reason: `Tổng tiền không khớp ${result.quantity} × ${result.unitPrice} = ${calculatedAmount}.`, action: "Kiểm tra số lượng, đơn giá hoặc tổng tiền." });
    }
  }
  if (hasMultipleTransactionSignals(result.rawInput)) {
    result = addCheck(result, { field: "transactionCount", value: "nhiều hơn 1", reason: "Câu nói có dấu hiệu chứa nhiều giao dịch.", action: "Tách mỗi giao dịch thành một lần ghi rồi xác nhận lại." });
  }
  if (result.amount !== null && context.history) {
    const comparable = context.history.filter((item) => item.type === result.type && item.canonicalItemName === result.canonicalItemName).map((item) => item.amount);
    const baseline = comparable.length >= 3 ? median(comparable) : null;
    if (baseline && result.amount >= baseline * 5) {
      result = addCheck(result, { field: "amount", value: String(result.amount), reason: `Tổng tiền cao bất thường so với ${comparable.length} giao dịch cùng loại/mặt hàng gần đây (trung vị ${baseline} VND).`, action: "Xác nhận lại số tiền trước khi lưu." });
    }
  }
  return result;
}
