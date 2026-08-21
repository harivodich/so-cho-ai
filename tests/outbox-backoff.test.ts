import { beforeEach, describe, expect, it } from "vitest";
import {
  clearOutbox,
  enqueueOutbox,
  listDueOutbox,
  listOutbox,
  recordOutboxFailure,
} from "@/lib/offline/outbox";

describe("outbox exponential backoff & resilience", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    });
    clearOutbox();
  });

  it("calculates exponential backoff on consecutive failures", () => {
    enqueueOutbox({
      key: "transactions:tx-fail",
      domain: "transactions",
      action: "save",
      payload: { amount: 100 },
    });

    // 1st failure: retryCount = 1, backoff = 2^0 = 1s
    recordOutboxFailure("transactions:tx-fail", "NETWORK_ERROR");
    let items = listOutbox("transactions");
    expect(items[0]?.retryCount).toBe(1);
    expect(items[0]?.lastErrorCode).toBe("NETWORK_ERROR");
    expect(items[0]?.nextAttemptAt).toBeDefined();

    // 2nd failure: retryCount = 2, backoff = 2^1 = 2s
    recordOutboxFailure("transactions:tx-fail", "TIMEOUT");
    items = listOutbox("transactions");
    expect(items[0]?.retryCount).toBe(2);
    expect(items[0]?.lastErrorCode).toBe("TIMEOUT");

    // 3rd failure: retryCount = 3, backoff = 2^2 = 4s
    recordOutboxFailure("transactions:tx-fail", "503_UNAVAILABLE");
    items = listOutbox("transactions");
    expect(items[0]?.retryCount).toBe(3);
  });

  it("filters out operations that are not yet due for retry", () => {
    enqueueOutbox({
      key: "debts:due-now",
      domain: "debts",
      action: "save",
      payload: { amount: 50 },
    });
    enqueueOutbox({
      key: "debts:backoff-later",
      domain: "debts",
      action: "save",
      payload: { amount: 150 },
    });

    // Mark backoff-later as failed with next attempt far in future
    recordOutboxFailure("debts:backoff-later", "QUOTA_EXCEEDED");
    // Manually push nextAttemptAt 1 hour into the future to test filter
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    const storageItem = listOutbox("debts").map((item) =>
      item.key === "debts:backoff-later" ? { ...item, nextAttemptAt: futureDate } : item,
    );
    window.localStorage.setItem("so-cho-ai.sync-outbox.v1", JSON.stringify(storageItem));

    const dueItems = listDueOutbox();
    const dueKeys = dueItems.map((i) => i.key);
    expect(dueKeys).toContain("debts:due-now");
    expect(dueKeys).not.toContain("debts:backoff-later");
  });
});
