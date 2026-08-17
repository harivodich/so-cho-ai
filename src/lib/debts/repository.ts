import type { DebtEntry } from "@/types/debt";
import { scopedStorageKey } from "@/lib/storage-scope";

export interface DebtRepository {
  readonly kind: "local" | "firebase";
  list(): Promise<DebtEntry[]>;
  save(entry: DebtEntry): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const LOCAL_STORAGE_KEY = "so-cho-ai.debts.v1";

function sortEntries(entries: DebtEntry[]): DebtEntry[] {
  return [...entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export class LocalDebtRepository implements DebtRepository {
  private readonly storageKey: string;

  constructor(scope?: string | null) {
    this.storageKey = scopedStorageKey(LOCAL_STORAGE_KEY, scope);
  }
  readonly kind = "local" as const;

  async list(): Promise<DebtEntry[]> {
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? sortEntries(parsed as DebtEntry[]) : [];
    } catch {
      return [];
    }
  }

  async save(entry: DebtEntry): Promise<void> {
    const entries = (await this.list()).filter((item) => item.id !== entry.id);
    entries.push(entry);
    window.localStorage.setItem(this.storageKey, JSON.stringify(sortEntries(entries)));
  }

  async remove(id: string): Promise<void> {
    const entries = (await this.list()).filter((entry) => entry.id !== id);
    window.localStorage.setItem(this.storageKey, JSON.stringify(entries));
  }

  async clear(): Promise<void> {
    window.localStorage.removeItem(this.storageKey);
  }
}
