import type { Counterparty } from "@/types/counterparty";
import { scopedStorageKey } from "@/lib/storage-scope";

export interface CounterpartyRepository {
  readonly kind: "local" | "firebase";
  list(): Promise<Counterparty[]>;
  save(counterparty: Counterparty): Promise<void>;
  clear(): Promise<void>;
}

const LOCAL_STORAGE_KEY = "so-cho-ai.counterparties.v1";

export class LocalCounterpartyRepository implements CounterpartyRepository {
  private readonly storageKey: string;

  constructor(scope?: string | null) {
    this.storageKey = scopedStorageKey(LOCAL_STORAGE_KEY, scope);
  }
  readonly kind = "local" as const;

  async list(): Promise<Counterparty[]> {
    if (typeof window === "undefined") return [];
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(this.storageKey) ?? "[]");
      return Array.isArray(parsed) ? parsed as Counterparty[] : [];
    } catch {
      return [];
    }
  }

  async save(counterparty: Counterparty): Promise<void> {
    const current = await this.list();
    const next = [...current.filter((item) => item.id !== counterparty.id), counterparty];
    window.localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  async clear(): Promise<void> {
    if (typeof window !== "undefined") window.localStorage.removeItem(this.storageKey);
  }
}
