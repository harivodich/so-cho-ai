import { describe, expect, it } from "vitest";

import { serializeTransactionsCsv, transactionsForExport } from "@/lib/export-transactions";
import type { ConfirmedTransaction } from "@/types/transaction";

function transaction(id: string, type: ConfirmedTransaction["type"], itemName: string, occurredAt: string): ConfirmedTransaction {
  return {
    id,
    userId: "user",
    inputMethod: "manual",
    type,
    itemName,
    canonicalItemName: itemName.toLocaleLowerCase("vi-VN"),
    quantity: 2,
    unit: "kg",
    unitPrice: 40_000,
    amount: 80_000,
    occurredAt,
    rawInput: "",
    fieldsNeedingReview: [],
    missingFields: [],
    warnings: [],
    confirmedAt: occurredAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

describe("transaction CSV export", () => {
  it("filters the active date range, type and item", () => {
    const rows = [
      transaction("1", "sale", "Xoài", "2026-08-02"),
      transaction("2", "purchase", "Xoài", "2026-08-03"),
      transaction("3", "sale", "Cam", "2026-09-01"),
    ];

    expect(transactionsForExport(rows, "2026-08-01", "2026-08-31", { transactionType: "sale" }).map((row) => row.id)).toEqual(["1"]);
  });

  it("writes UTF-8, semicolon-delimited CSV for Vietnamese Excel and neutralizes formulas", () => {
    const csv = serializeTransactionsCsv([transaction("1", "sale", '=HYPERLINK("bad"); Xoài', "2026-08-02")]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[0]).toContain('"Ngày";"Loại";"Mặt hàng"');
    expect(csv).toContain('"\'=HYPERLINK(""bad""); Xoài"');
    expect(csv).toContain('"80000"');
  });
});
