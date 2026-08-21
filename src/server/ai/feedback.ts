import type { DraftCorrectionEvent } from "@/types/ai";
import type { ConfirmedTransaction, TransactionDraft } from "@/types/transaction";

export function analyzeDraftCorrection(
  runId: string,
  mode: "voice" | "image",
  originalDraft: TransactionDraft,
  confirmed: ConfirmedTransaction,
): DraftCorrectionEvent[] {
  const events: DraftCorrectionEvent[] = [];

  // Type modification check
  events.push({
    runId,
    mode,
    field: "type",
    wasModified: originalDraft.type !== confirmed.type,
    originalEmpty: !originalDraft.type,
  });

  // Amount modification check
  events.push({
    runId,
    mode,
    field: "amount",
    wasModified: originalDraft.amount !== confirmed.amount,
    originalEmpty: originalDraft.amount === null || originalDraft.amount === undefined,
  });

  // Item modification check
  events.push({
    runId,
    mode,
    field: "item",
    wasModified: (originalDraft.canonicalItemName || originalDraft.itemName || "") !== (confirmed.canonicalItemName || confirmed.itemName || ""),
    originalEmpty: !originalDraft.canonicalItemName && !originalDraft.itemName,
  });

  // Quantity check
  events.push({
    runId,
    mode,
    field: "quantity",
    wasModified: originalDraft.quantity !== confirmed.quantity,
    originalEmpty: originalDraft.quantity === null || originalDraft.quantity === undefined,
  });

  // Unit check
  events.push({
    runId,
    mode,
    field: "unit",
    wasModified: (originalDraft.unit || "") !== (confirmed.unit || ""),
    originalEmpty: !originalDraft.unit,
  });

  // Raw input check
  events.push({
    runId,
    mode,
    field: "note",
    wasModified: (originalDraft.rawInput || "") !== (confirmed.rawInput || ""),
    originalEmpty: !originalDraft.rawInput,
  });

  return events;
}
