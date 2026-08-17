import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createBackup, parseBackup, reassignBackupOwner } from "@/lib/backup";
import type { ConfirmedTransaction } from "@/types/transaction";

const transaction: ConfirmedTransaction = {
  id: "t1", userId: "u1", inputMethod: "manual", type: "sale", itemName: "Xoài", canonicalItemName: "xoài", quantity: 1, unit: "kg", unitPrice: 100000, amount: 100000, occurredAt: "2026-08-01", rawInput: "", fieldsNeedingReview: [], missingFields: [], warnings: [], qualityChecks: [], confirmedAt: "2026-08-01T00:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("backup contract", () => {
  it("round-trips transactions and debts through a versioned payload", () => {
    const backup = createBackup([transaction], []);
    expect(parseBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
  });

  it("reassigns imported records to the active account", () => {
    const backup = createBackup([transaction], []);
    const reassigned = reassignBackupOwner(backup, "u2");
    expect(reassigned.transactions[0]?.userId).toBe("u2");
  });
  it("rejects malformed payloads instead of importing them", () => {
    expect(() => parseBackup({ version: 1, transactions: [], debts: [] })).toThrow();
  });

  it("uses the reconciled product when importing standalone stock adjustments", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain("const importedProducts = new Map");
    expect(page).toContain("importedProducts.get(movement.productId)");
  });
});
