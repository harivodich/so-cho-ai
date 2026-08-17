import { describe, expect, it } from "vitest";

import { scopedStorageKey, storageScope } from "@/lib/storage-scope";

describe("scoped local storage keys", () => {
  it("separates accounts and uses a stable device fallback", () => {
    expect(storageScope(null)).toBe("device");
    expect(scopedStorageKey("transactions", "uid-a")).not.toBe(scopedStorageKey("transactions", "uid-b"));
    expect(scopedStorageKey("transactions", undefined)).toBe("transactions.device");
  });

  it("encodes UID-like scopes so delimiters cannot collide", () => {
    expect(scopedStorageKey("transactions", "a.b/c")).toBe("transactions.a.b%2Fc");
    expect(scopedStorageKey("transactions", "a.b%2Fc")).not.toBe(scopedStorageKey("transactions", "a.b/c"));
  });
});