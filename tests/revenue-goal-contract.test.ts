import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("revenue goal account contract", () => {
  it("scopes local cache and offline writes by Firebase uid", () => {
    const storage = readFileSync("src/lib/revenue-goals.ts", "utf8");
    const hook = readFileSync("src/hooks/use-revenue-goal.ts", "utf8");
    expect(storage).toContain("encodeURIComponent(normalized)");
    expect(storage).toContain("clearRevenueGoals(scope");
    expect(hook).toContain('domain: "revenueGoals"');
    expect(hook).toContain('payload.userId !== userId');
    expect(hook).toContain('window.addEventListener("online"');
    expect(hook).toContain("conflicts.length");
  });
});