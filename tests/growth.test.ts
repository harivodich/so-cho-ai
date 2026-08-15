import { describe, expect, it } from "vitest";

import { buildMonthlyActions, calculateRevenueGoalStatus } from "@/lib/growth";
import { calculateMonthlyReport } from "@/lib/reports";
import type { ConfirmedTransaction } from "@/types/transaction";

function transaction(
  id: string,
  type: ConfirmedTransaction["type"],
  amount: number,
  occurredAt: string,
  itemName = "Xoài",
): ConfirmedTransaction {
  return {
    id,
    userId: "test-user",
    inputMethod: "manual",
    type,
    itemName,
    canonicalItemName: itemName.toLocaleLowerCase("vi-VN"),
    quantity: 1,
    unit: "kg",
    unitPrice: amount,
    amount,
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

describe("revenue goal", () => {
  it("calculates the current-month pace with today included", () => {
    const report = calculateMonthlyReport(
      [transaction("sale-1", "sale", 400_000, "2026-08-05T08:00:00.000Z")],
      "2026-08",
    );

    expect(calculateRevenueGoalStatus(report, 1_000_000, "2026-08-12")).toMatchObject({
      target: 1_000_000,
      achievedPercent: 40,
      remainingRevenue: 600_000,
      remainingDays: 20,
      requiredDailyAverage: 30_000,
      isAchieved: false,
      periodEnded: false,
    });
  });

  it("marks an achieved goal without asking for more daily revenue", () => {
    const report = calculateMonthlyReport(
      [transaction("sale-1", "sale", 1_200_000, "2026-08-05T08:00:00.000Z")],
      "2026-08",
    );

    expect(calculateRevenueGoalStatus(report, 1_000_000, "2026-08-12")).toMatchObject({
      achievedPercent: 100,
      remainingRevenue: 0,
      requiredDailyAverage: 0,
      isAchieved: true,
    });
  });

  it("does not invent a pace for a finished month", () => {
    const report = calculateMonthlyReport(
      [transaction("sale-1", "sale", 400_000, "2026-07-05T08:00:00.000Z")],
      "2026-07",
    );

    expect(calculateRevenueGoalStatus(report, 1_000_000, "2026-08-12")).toMatchObject({
      remainingDays: 0,
      requiredDailyAverage: null,
      periodEnded: true,
    });
  });

  it("prioritizes missing cost and measured revenue changes", () => {
    const report = calculateMonthlyReport(
      [
        transaction("previous", "sale", 1_000_000, "2026-07-05T08:00:00.000Z", "Cam"),
        transaction("current", "sale", 400_000, "2026-08-05T08:00:00.000Z", "Xoài"),
      ],
      "2026-08",
    );
    const goal = calculateRevenueGoalStatus(report, 1_000_000, "2026-08-12");
    const actions = buildMonthlyActions(report, goal);

    expect(actions.map((action) => action.id)).toEqual([
      "missing-cost",
      "goal-progress",
      "revenue-down",
      "top-item",
    ]);
  });
});
