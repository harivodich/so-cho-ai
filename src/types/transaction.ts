import { z } from "zod";

export const transactionTypes = ["sale", "purchase", "expense"] as const;
export const inputMethods = ["manual", "voice", "image"] as const;

export type TransactionType = (typeof transactionTypes)[number];
export type InputMethod = (typeof inputMethods)[number];

const nullableTrimmedString = z.string().trim().min(1).nullable();
const nullablePositiveNumber = z.number().finite().positive().nullable();
export const dataQualityCheckSchema = z.object({
  field: z.enum(["amount", "occurredAt", "type", "transactionCount"]),
  value: z.string(),
  reason: z.string().min(1),
  action: z.string().min(1),
});
export type DataQualityCheck = z.infer<typeof dataQualityCheckSchema>;

export const transactionDraftSchema = z.object({
  type: z.enum(transactionTypes).nullable(),
  itemName: nullableTrimmedString,
  canonicalItemName: nullableTrimmedString,
  quantity: nullablePositiveNumber,
  unit: nullableTrimmedString,
  unitPrice: nullablePositiveNumber,
  amount: nullablePositiveNumber,
  occurredAt: z.string().date().nullable(),
  rawInput: z.string(),
  fieldsNeedingReview: z.array(z.string()),
  missingFields: z.array(z.string()),
  warnings: z.array(z.string()),
  qualityChecks: z.array(dataQualityCheckSchema).default([]),
});

export type TransactionDraft = z.infer<typeof transactionDraftSchema>;

export const confirmedTransactionSchema = transactionDraftSchema.extend({
  id: z.string().min(1),
  userId: z.string().min(1),
  inputMethod: z.enum(inputMethods),
  type: z.enum(transactionTypes),
  amount: z.number().finite().positive(),
  occurredAt: z.string().date(),
  confirmedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConfirmedTransaction = z.infer<typeof confirmedTransactionSchema>;

export type ManualTransactionInput = {
  type: TransactionType;
  itemName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
  occurredAt: string;
};

export function canonicalizeItemName(itemName: string | null): string | null {
  if (!itemName) {
    return null;
  }

  const normalized = itemName.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");
  return normalized || null;
}

export function createManualDraft(input: ManualTransactionInput): TransactionDraft {
  const itemName = input.itemName?.trim() || null;
  const quantity = input.quantity ?? null;
  const unitPrice = input.unitPrice ?? null;
  const expectedAmount = quantity && unitPrice ? quantity * unitPrice : null;
  const warnings =
    expectedAmount !== null && expectedAmount !== input.amount
      ? ["Thành tiền không khớp với số lượng × đơn giá. Hãy kiểm tra trước khi lưu."]
      : [];

  return {
    type: input.type,
    itemName,
    canonicalItemName: canonicalizeItemName(itemName),
    quantity,
    unit: input.unit?.trim() || null,
    unitPrice,
    amount: input.amount,
    occurredAt: input.occurredAt,
    rawInput: "",
    fieldsNeedingReview: [],
    missingFields: [],
    warnings,
    qualityChecks: [],
  };
}
