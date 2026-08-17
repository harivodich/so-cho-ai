import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { counterpartySchema } from "@/types/counterparty";

describe("counterparty schema", () => {
  it("accepts a UID-scoped named party", () => {
    expect(counterpartySchema.parse({
      id: "cp-1",
      userId: "user-1",
      name: "Khách A",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }).name).toBe("Khách A");
  });

  it("queues saves for offline retry", () => {
    const hook = readFileSync("src/hooks/use-counterparties.ts", "utf8");
    expect(hook).toContain('listOutbox("counterparties", outboxOwner)');
    expect(hook).toContain('domain: "counterparties"');
    expect(hook).toContain('window.addEventListener("online"');
  });
});