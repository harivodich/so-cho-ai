import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { debtEntrySchema, debtPaidAmount, debtRemainingAmount, summarizeDebtLedger, summarizeDebts, type DebtEntry } from "@/types/debt";

function debt(partial: Partial<DebtEntry>): DebtEntry {
  return {
    id: partial.id ?? "1",
    userId: "u1",
    partyName: "A",
    direction: partial.direction ?? "receivable",
    amount: partial.amount ?? 100000,
    dueDate: partial.dueDate ?? null,
    note: "",
    status: partial.status ?? "open",
    paidAmount: partial.paidAmount,
    payments: partial.payments,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("summarizeDebts", () => {
  it("separates open receivables/payables and excludes settled entries", () => {
    expect(summarizeDebts([
      debt({ amount: 100000 }),
      debt({ id: "2", direction: "payable", amount: 50000 }),
      debt({ id: "3", status: "settled", amount: 90000 }),
    ])).toEqual({ receivable: 100000, payable: 50000, openCount: 2 });
  });

  it("uses ledger payments when legacy paidAmount is missing", () => {
    const entry = debt({
      amount: 100000,
      status: "partial",
      payments: [{ id: "legacy-pay", amount: 40000, paidAt: "2026-08-01", note: "" }],
    });
    expect(debtPaidAmount(entry)).toBe(40000);
    expect(debtRemainingAmount(entry)).toBe(60000);
  });

  it("tracks partial payments and overdue balances", () => {
    const entry = debt({
      amount: 100000,
      status: "partial",
      paidAmount: 40000,
      dueDate: "2026-08-01",
      payments: [{ id: "pay1", amount: 40000, paidAt: "2026-08-01", note: "" }],
    });
    expect(debtRemainingAmount(entry)).toBe(60000);
    expect(summarizeDebtLedger([entry], "2026-08-05")).toMatchObject({ receivable: 60000, outstanding: 60000, overdueCount: 1 });
    expect(summarizeDebts([entry])).toMatchObject({ receivable: 60000, openCount: 1 });
  });

  it("rejects payment ledgers that exceed or contradict the debt amount", () => {
    const base = {
      id: "1",
      userId: "u1",
      partyName: "A",
      direction: "receivable" as const,
      amount: 100000,
      dueDate: null,
      note: "",
      status: "partial" as const,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    expect(debtEntrySchema.safeParse({ ...base, paidAmount: 120000, payments: [] }).success).toBe(false);
    expect(debtEntrySchema.safeParse({ ...base, paidAmount: 20000, payments: [{ id: "p1", amount: 40000, paidAt: "2026-08-01", note: "" }] }).success).toBe(false);
    expect(debtEntrySchema.safeParse({ ...base, paidAmount: 40000, payments: [{ id: "p1", amount: 40000, paidAt: "2026-08-01", note: "" }] }).success).toBe(true);
  });

  it("renders legacy payment totals from the ledger", () => {
    expect(readFileSync("src/components/debt-workspace.tsx", "utf8")).toContain("formatVnd(debtPaidAmount(entry))");
  });
});