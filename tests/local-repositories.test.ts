import { beforeEach, describe, expect, it } from "vitest";

import { LocalCatalogRepository } from "@/lib/catalog/repository";
import { LocalCounterpartyRepository } from "@/lib/counterparties/repository";
import { LocalDebtRepository } from "@/lib/debts/repository";
import type { Product, StockMovement } from "@/types/catalog";
import type { Counterparty } from "@/types/counterparty";
import type { DebtEntry } from "@/types/debt";

function installLocalStorage() {
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
  return storage;
}

const debt = (id: string, updatedAt: string): DebtEntry => ({
  id,
  userId: "uid-a",
  partyName: "Khach A",
  direction: "receivable",
  amount: 100000,
  dueDate: null,
  note: "",
  status: "open",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt,
});

const product: Product = {
  id: "product-1",
  userId: "uid-a",
  name: "Xoai",
  canonicalName: "xoai",
  defaultUnit: "kg",
  lowStockThreshold: 5,
  active: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const movement: StockMovement = {
  id: "movement-1",
  userId: "uid-a",
  productId: "product-1",
  itemName: "Xoai",
  canonicalItemName: "xoai",
  unit: "kg",
  kind: "adjustment",
  quantityDelta: -2,
  reason: "Kiem ke",
  sourceTransactionId: null,
  occurredAt: "2026-08-02",
  createdAt: "2026-08-02T00:00:00.000Z",
};

const counterparty: Counterparty = {
  id: "counterparty-1",
  userId: "uid-a",
  name: "Khach A",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("local repositories", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("replaces debts by id and keeps newest entries first", async () => {
    const repository = new LocalDebtRepository("uid-a");
    await repository.save(debt("debt-1", "2026-08-01T00:00:00.000Z"));
    await repository.save(debt("debt-2", "2026-08-03T00:00:00.000Z"));
    await repository.save({ ...debt("debt-1", "2026-08-04T00:00:00.000Z"), amount: 125000 });

    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({ id: "debt-1", amount: 125000 }),
      expect.objectContaining({ id: "debt-2" }),
    ]);
    await repository.remove("debt-2");
    await expect(repository.list()).resolves.toHaveLength(1);
    await repository.clear();
    await expect(repository.list()).resolves.toEqual([]);
  });

  it("isolates catalog products and movements by owner scope", async () => {
    const accountA = new LocalCatalogRepository("uid-a");
    const accountB = new LocalCatalogRepository("uid-b");
    await accountA.saveProduct(product);
    await accountA.saveMovement(movement);

    await expect(accountA.listProducts()).resolves.toEqual([product]);
    await expect(accountA.listMovements()).resolves.toEqual([movement]);
    await expect(accountB.listProducts()).resolves.toEqual([]);
    await expect(accountB.listMovements()).resolves.toEqual([]);

    await accountA.clear();
    await expect(accountA.listProducts()).resolves.toEqual([]);
    await expect(accountA.listMovements()).resolves.toEqual([]);
  });

  it("ignores malformed counterparty storage and clears only its scope", async () => {
    const storage = installLocalStorage();
    storage.set("so-cho-ai.counterparties.v1.uid-a", "not-json");
    const accountA = new LocalCounterpartyRepository("uid-a");
    const accountB = new LocalCounterpartyRepository("uid-b");
    await accountB.save(counterparty);

    await expect(accountA.list()).resolves.toEqual([]);
    await expect(accountB.list()).resolves.toEqual([counterparty]);
    await accountA.clear();
    await expect(accountB.list()).resolves.toEqual([counterparty]);
  });
});