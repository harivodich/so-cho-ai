import { beforeEach, describe, expect, it } from "vitest";

import { clearOutbox, clearOutboxForOwner, enqueueOutbox, listOutbox, removeOutbox } from "@/lib/offline/outbox";

describe("offline outbox", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      } },
    });
    clearOutbox();
  });

  it("deduplicates a pending save by stable resource key", () => {
    enqueueOutbox({ key: "transactions:t1", domain: "transactions", action: "save", payload: { amount: 1 } });
    enqueueOutbox({ key: "transactions:t1", domain: "transactions", action: "save", payload: { amount: 2 } });
    expect(listOutbox("transactions")).toHaveLength(1);
    expect(listOutbox("transactions")[0]?.payload).toEqual({ amount: 2 });
  });


  it("does not mix pending operations between owners", () => {
    enqueueOutbox({ key: "transactions:same", ownerId: "uid-a", domain: "transactions", action: "save", payload: { userId: "uid-a", amount: 1 } });
    enqueueOutbox({ key: "transactions:same", ownerId: "uid-b", domain: "transactions", action: "save", payload: { userId: "uid-b", amount: 2 } });
    expect(listOutbox("transactions", "uid-a")).toHaveLength(1);
    expect(listOutbox("transactions", "uid-a")[0]?.payload).toMatchObject({ amount: 1 });
    expect(listOutbox("transactions", "uid-b")[0]?.payload).toMatchObject({ amount: 2 });
  });
  it("clears only the selected owner", () => {
    enqueueOutbox({ key: "transactions:a", ownerId: "uid-a", domain: "transactions", action: "save", payload: { userId: "uid-a" } });
    enqueueOutbox({ key: "transactions:b", ownerId: "uid-b", domain: "transactions", action: "save", payload: { userId: "uid-b" } });
    clearOutboxForOwner("uid-a");
    expect(listOutbox(undefined, "uid-a")).toEqual([]);
    expect(listOutbox(undefined, "uid-b")).toHaveLength(1);
  });
  it("removes an operation after a successful retry", () => {
    enqueueOutbox({ key: "debts:d1", domain: "debts", action: "remove", payload: null });
    removeOutbox("debts:d1");
    expect(listOutbox()).toEqual([]);
  });

  it("removes only the requested owner's operation when keys collide", () => {
    enqueueOutbox({ key: "transactions:same", ownerId: "uid-a", domain: "transactions", action: "save", payload: { userId: "uid-a" } });
    enqueueOutbox({ key: "transactions:same", ownerId: "uid-b", domain: "transactions", action: "save", payload: { userId: "uid-b" } });
    removeOutbox("transactions:same", "uid-a");
    expect(listOutbox(undefined, "uid-a")).toEqual([]);
    expect(listOutbox(undefined, "uid-b")).toHaveLength(1);
  });
});
