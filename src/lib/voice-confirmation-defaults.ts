import type { TransactionDraft } from "@/types/transaction";

const DEFAULT_DATE_NOTICE = "Đã đặt ngày giao dịch là hôm nay. Sửa lại nếu giao dịch diễn ra ngày khác.";

/**
 * The date is supplied by the app, never inferred by Gemini. It keeps an
 * otherwise complete voice draft saveable while the confirmation step remains
 * the user's explicit approval of that default.
 */
export function applyVoiceConfirmationDefaults(draft: TransactionDraft, currentDate: string): TransactionDraft {
  if (draft.occurredAt) return draft;

  return {
    ...draft,
    occurredAt: currentDate,
    missingFields: draft.missingFields.filter((field) => field !== "occurredAt"),
    fieldsNeedingReview: [...new Set([...draft.fieldsNeedingReview, "occurredAt"])],
    warnings: [...new Set([...draft.warnings, DEFAULT_DATE_NOTICE])],
  };
}
