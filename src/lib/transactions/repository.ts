import type { ConfirmedTransaction } from "@/types/transaction";
import { scopedStorageKey } from "@/lib/storage-scope";

export interface TransactionRepository {
  readonly kind: "local" | "firebase";
  list(): Promise<ConfirmedTransaction[]>;
  save(transaction: ConfirmedTransaction): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const LOCAL_STORAGE_KEY = "so-cho-ai.transactions.v1";

function sortTransactions(transactions: ConfirmedTransaction[]): ConfirmedTransaction[] {
  return [...transactions].sort((left, right) => {
    const dateOrder = right.occurredAt.localeCompare(left.occurredAt);
    return dateOrder !== 0 ? dateOrder : right.updatedAt.localeCompare(left.updatedAt);
  });
}

export class LocalTransactionRepository implements TransactionRepository {
  readonly kind = "local" as const;

  private readonly storageKey: string;

  constructor(scope?: string | null) {
    this.storageKey = scopedStorageKey(LOCAL_STORAGE_KEY, scope);
  }

  async list(): Promise<ConfirmedTransaction[]> {
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? sortTransactions(parsed as ConfirmedTransaction[]) : [];
    } catch {
      return [];
    }
  }

  async save(transaction: ConfirmedTransaction): Promise<void> {
    const existing = await this.list();
    const next = existing.filter((item) => item.id !== transaction.id);
    next.push(transaction);
    window.localStorage.setItem(this.storageKey, JSON.stringify(sortTransactions(next)));
  }

  async remove(id: string): Promise<void> {
    const next = (await this.list()).filter((transaction) => transaction.id !== id);
    window.localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  async clear(): Promise<void> {
    window.localStorage.removeItem(this.storageKey);
  }
}
