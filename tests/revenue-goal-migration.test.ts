import { describe, expect, it } from "vitest";

import { mergeRevenueGoalScopes } from "@/lib/revenue-goal-migration";

describe("revenue goal scope migration", () => {
  it("moves device goals that are not present in the account", () => {
    expect(mergeRevenueGoalScopes({}, { "2026-08": 1000000 }, {})).toEqual({
      goals: { "2026-08": 1000000 },
      migratedMonths: ["2026-08"],
      conflicts: [],
    });
  });

  it("keeps existing account goals and reports conflicts without overwriting", () => {
    expect(mergeRevenueGoalScopes({ "2026-08": 2000000 }, { "2026-08": 1000000, "2026-09": 3000000 }, {})).toEqual({
      goals: { "2026-08": 2000000, "2026-09": 3000000 },
      migratedMonths: ["2026-09"],
      conflicts: ["2026-08"],
    });
  });

  it("seeds UID-local goals only when remote settings are empty", () => {
    expect(mergeRevenueGoalScopes({}, {}, { "2026-10": 4000000 })).toMatchObject({
      goals: { "2026-10": 4000000 },
      migratedMonths: [],
      conflicts: [],
    });
  });
});
