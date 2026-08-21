import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { triggerHapticFeedback } from "@/lib/haptic";
import { debtRemainingAmount, debtPaidAmount, type DebtEntry } from "@/types/debt";
import { canonicalizeItemName, type ConfirmedTransaction } from "@/types/transaction";

describe("Upgrades Test Suite", () => {
  describe("1. PWA & Service Worker", () => {
    it("has valid manifest.webmanifest with proper metadata and icon definitions", () => {
      const manifestPath = join(process.cwd(), "public", "manifest.webmanifest");
      expect(existsSync(manifestPath)).toBe(true);

      const content = JSON.parse(readFileSync(manifestPath, "utf8"));
      expect(content.name).toContain("Sổ Chợ AI");
      expect(content.display).toBe("standalone");
      expect(content.start_url).toBe("/");
      expect(content.icons.length).toBeGreaterThan(0);
      expect(content.icons[0].src).toBe("/icons/icon.svg");
    });

    it("has valid sw.js file with offline cache handlers", () => {
      const swPath = join(process.cwd(), "public", "sw.js");
      expect(existsSync(swPath)).toBe(true);

      const swContent = readFileSync(swPath, "utf8");
      expect(swContent).toContain("so-cho-ai-cache");
      expect(swContent).toContain("addEventListener(\"install\"");
      expect(swContent).toContain("addEventListener(\"fetch\"");
    });
  });

  describe("2. Haptic Feedback Utility", () => {
    it("handles triggerHapticFeedback safely without error in node or browser", () => {
      expect(() => triggerHapticFeedback()).not.toThrow();
      expect(() => triggerHapticFeedback(50)).not.toThrow();
      expect(() => triggerHapticFeedback([20, 30, 40])).not.toThrow();
    });
  });

  describe("3. Autocomplete & Item Matching", () => {
    it("canonicalizes item names for fuzzy matching", () => {
      expect(canonicalizeItemName("  Xoài Cát Hòa Lộc ")).toBe("xoài cát hòa lộc");
      expect(canonicalizeItemName("CÀ CHUA SẠCH")).toBe("cà chua sạch");
      expect(canonicalizeItemName("")).toBeNull();
      expect(canonicalizeItemName(null)).toBeNull();
    });
  });

  describe("4. Debt Overdue & Priority Calculation", () => {
    const today = "2026-08-17";

    it("correctly identifies remaining amount and overdue status", () => {
      const overdueDebt: DebtEntry = {
        id: "d1",
        userId: "u1",
        partyName: "Chị Lan",
        direction: "receivable",
        amount: 500_000,
        paidAmount: 200_000,
        payments: [{ id: "p1", amount: 200_000, paidAt: "2026-08-10", note: "Tiền mặt" }],
        dueDate: "2026-08-15", // Before today -> Overdue
        status: "partial",
        note: "Hẹn thứ 6",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
      };

      const remaining = debtRemainingAmount(overdueDebt);
      expect(remaining).toBe(300_000);
      expect(debtPaidAmount(overdueDebt)).toBe(200_000);

      const isOverdue = overdueDebt.status !== "settled" && remaining > 0 && overdueDebt.dueDate !== null && overdueDebt.dueDate < today;
      expect(isOverdue).toBe(true);
    });

    it("does not mark settled debt as overdue even if dueDate is past", () => {
      const settledDebt: DebtEntry = {
        id: "d2",
        userId: "u1",
        partyName: "Anh Ba",
        direction: "payable",
        amount: 400_000,
        paidAmount: 400_000,
        payments: [{ id: "p2", amount: 400_000, paidAt: "2026-08-14", note: "CK" }],
        dueDate: "2026-08-12",
        status: "settled",
        note: "",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-14T00:00:00.000Z",
      };

      const remaining = debtRemainingAmount(settledDebt);
      expect(remaining).toBe(0);
      const isOverdue = settledDebt.status !== "settled" && remaining > 0 && settledDebt.dueDate !== null && settledDebt.dueDate < today;
      expect(isOverdue).toBe(false);
    });
  });

  describe("5. Search & Filter Matching Logic", () => {
    const transactions: ConfirmedTransaction[] = [
      {
        id: "t1",
        userId: "u1",
        inputMethod: "manual",
        type: "sale",
        itemName: "Xoài cát",
        canonicalItemName: "xoài cát",
        quantity: 10,
        unit: "kg",
        unitPrice: 35000,
        amount: 350000,
        occurredAt: "2026-08-17",
        rawInput: "",
        fieldsNeedingReview: [],
        missingFields: [],
        warnings: [],
        qualityChecks: [],
        confirmedAt: "2026-08-17T08:00:00.000Z",
        createdAt: "2026-08-17T08:00:00.000Z",
        updatedAt: "2026-08-17T08:00:00.000Z",
      },
      {
        id: "t2",
        userId: "u1",
        inputMethod: "voice",
        type: "purchase",
        itemName: "Bao bì đóng gói",
        canonicalItemName: "bao bì đóng gói",
        quantity: 100,
        unit: "cái",
        unitPrice: 500,
        amount: 50000,
        occurredAt: "2026-08-16",
        rawInput: "nhập một trăm cái bao bì năm mươi nghìn",
        fieldsNeedingReview: [],
        missingFields: [],
        warnings: [],
        qualityChecks: [],
        confirmedAt: "2026-08-16T10:00:00.000Z",
        createdAt: "2026-08-16T10:00:00.000Z",
        updatedAt: "2026-08-16T10:00:00.000Z",
      },
    ];

    it("filters transactions by search query matching itemName or amount", () => {
      const queryItem = "xoài";
      const matches1 = transactions.filter((t) => t.itemName?.toLowerCase().includes(queryItem));
      expect(matches1.length).toBe(1);
      expect(matches1[0].id).toBe("t1");

      const queryAmount = "350000";
      const matches2 = transactions.filter((t) => String(t.amount).includes(queryAmount));
      expect(matches2.length).toBe(1);
      expect(matches2[0].id).toBe("t1");
    });
  });
});
