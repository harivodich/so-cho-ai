import { z } from "zod";

import {
  canonicalizeItemName,
  transactionDraftSchema,
  type TransactionDraft,
} from "@/types/transaction";

export class ExtractionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionValidationError";
  }
}

export const extractionDraftsSchema = z.array(transactionDraftSchema).max(1);
export const extractionResponseSchema = z.object({ drafts: extractionDraftsSchema });

const nullableStringSchema = { type: "string", nullable: true };
const nullableNumberSchema = { type: "number", nullable: true };

export const transactionDraftsJsonSchema = {
  type: "array",
  minItems: 0,
  maxItems: 1,
  items: {
    type: "object",
    properties: {
      type: { type: "string", nullable: true, enum: ["sale", "purchase", "expense"] },
      itemName: nullableStringSchema,
      canonicalItemName: nullableStringSchema,
      quantity: nullableNumberSchema,
      unit: nullableStringSchema,
      unitPrice: nullableNumberSchema,
      amount: nullableNumberSchema,
      occurredAt: { type: "string", nullable: true, format: "date" },
      rawInput: { type: "string" },
      fieldsNeedingReview: { type: "array", items: { type: "string" } },
      missingFields: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: [
      "type",
      "itemName",
      "canonicalItemName",
      "quantity",
      "unit",
      "unitPrice",
      "amount",
      "occurredAt",
      "rawInput",
      "fieldsNeedingReview",
      "missingFields",
      "warnings",
    ],
  },
} as const;

function mergeUnique(values: string[], additions: string[]): string[] {
  return [...new Set([...values, ...additions])];
}

function requireReview(draft: TransactionDraft, currentDate: string): TransactionDraft {
  const missingFields = [...draft.missingFields];
  const fieldsNeedingReview = [...draft.fieldsNeedingReview];
  const warnings = [...draft.warnings];

  if (!draft.rawInput.trim()) {
    warnings.push("Không nghe rõ nội dung audio. Hãy nhập tay hoặc ghi lại câu nói ngắn hơn.");
    fieldsNeedingReview.push("rawInput");
  }
  if (!draft.type) missingFields.push("type");
  if (!draft.amount) missingFields.push("amount");
  if (!draft.occurredAt) missingFields.push("occurredAt");

  if (draft.amount !== null && !Number.isSafeInteger(draft.amount)) {
    throw new ExtractionValidationError("Tổng tiền phải là số nguyên VND.");
  }
  if (draft.unitPrice !== null && !Number.isSafeInteger(draft.unitPrice)) {
    throw new ExtractionValidationError("Đơn giá phải là số nguyên VND.");
  }
  if (draft.quantity !== null && draft.unitPrice !== null && draft.amount !== null) {
    const calculatedAmount = Math.round(draft.quantity * draft.unitPrice);
    if (calculatedAmount !== draft.amount) {
      warnings.push("Tổng tiền không khớp với số lượng × đơn giá. Hãy kiểm tra trước khi lưu.");
      fieldsNeedingReview.push("amount");
    }
  }
  if (draft.occurredAt && draft.occurredAt > currentDate) {
    warnings.push("Ngày giao dịch nằm sau ngày hiện tại. Hãy kiểm tra lại trước khi lưu.");
    fieldsNeedingReview.push("occurredAt");
  }

  return {
    ...draft,
    canonicalItemName: canonicalizeItemName(draft.itemName),
    rawInput: draft.rawInput.trim(),
    fieldsNeedingReview: mergeUnique(fieldsNeedingReview, []),
    missingFields: mergeUnique(missingFields, []),
    warnings: mergeUnique(warnings, []),
  };
}

export function parseExtractionDrafts(value: unknown, currentDate: string): TransactionDraft[] {
  const drafts = extractionDraftsSchema.safeParse(value);
  if (!drafts.success) {
    throw new ExtractionValidationError("Gemini trả dữ liệu không đúng cấu trúc giao dịch.");
  }

  return drafts.data.map((draft) => requireReview(draft, currentDate));
}
