export type OutboxDomain = "transactions" | "debts" | "products" | "stockMovements" | "counterparties" | "revenueGoals";
export type OutboxAction = "save" | "remove";

export type OutboxOperation = {
  key: string;
  domain: OutboxDomain;
  action: OutboxAction;
  payload: unknown;
  ownerId?: string;
  queuedAt: string;
  retryCount?: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lastErrorCode?: string;
};

const OUTBOX_KEY = "so-cho-ai.sync-outbox.v1";
const MAX_BACKOFF_SECONDS = 60;

function readRaw(): OutboxOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as OutboxOperation[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(items: OutboxOperation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

function operationOwner(operation: OutboxOperation): string {
  return payloadOwner(operation) ?? "device";
}

function payloadOwner(operation: OutboxOperation): string | undefined {
  if (operation.ownerId) return operation.ownerId;
  if (operation.payload && typeof operation.payload === "object" && "userId" in operation.payload) {
    const userId = (operation.payload as { userId?: unknown }).userId;
    return typeof userId === "string" && userId.length > 0 ? userId : undefined;
  }
  return undefined;
}

export function listOutbox(domain?: OutboxDomain, ownerId?: string | null): OutboxOperation[] {
  const items = readRaw();
  const byDomain = domain ? items.filter((item) => item.domain === domain) : items;
  if (ownerId === undefined) return byDomain;
  const owner = ownerId || "device";
  return byDomain.filter((item) => operationOwner(item) === owner);
}

export function listDueOutbox(domain?: OutboxDomain, ownerId?: string | null): OutboxOperation[] {
  const all = listOutbox(domain, ownerId);
  const now = Date.now();
  return all.filter((item) => {
    if (!item.nextAttemptAt) return true;
    return new Date(item.nextAttemptAt).getTime() <= now;
  });
}

export function enqueueOutbox(operation: Omit<OutboxOperation, "queuedAt">): void {
  const incomingOwner = operation.ownerId ?? operationOwner(operation as OutboxOperation);
  const current = readRaw().filter((item) => item.key !== operation.key || operationOwner(item) !== incomingOwner);
  current.push({
    ...operation,
    queuedAt: new Date().toISOString(),
    retryCount: operation.retryCount ?? 0,
  });
  writeRaw(current);
}

export function recordOutboxFailure(key: string, errorCode: string, ownerId?: string | null): void {
  const owner = ownerId || "device";
  const items = readRaw().map((item) => {
    if (item.key === key && (ownerId === undefined || operationOwner(item) === owner)) {
      const nextCount = (item.retryCount ?? 0) + 1;
      const backoffSec = Math.min(Math.pow(2, nextCount - 1), MAX_BACKOFF_SECONDS);
      const nextAttempt = new Date(Date.now() + backoffSec * 1000).toISOString();
      return {
        ...item,
        retryCount: nextCount,
        lastAttemptAt: new Date().toISOString(),
        nextAttemptAt: nextAttempt,
        lastErrorCode: errorCode,
      };
    }
    return item;
  });
  writeRaw(items);
}

export function removeOutbox(key: string, ownerId?: string | null): void {
  if (ownerId === undefined) {
    writeRaw(readRaw().filter((item) => item.key !== key));
    return;
  }
  const owner = ownerId || "device";
  writeRaw(readRaw().filter((item) => item.key !== key || operationOwner(item) !== owner));
}

export function clearOutboxForOwner(ownerId: string | null | undefined, domain?: OutboxDomain): void {
  const owner = ownerId || "device";
  writeRaw(
    readRaw().filter((item) => {
      if (domain && item.domain !== domain) return true;
      return operationOwner(item) !== owner;
    }),
  );
}

export function clearOutbox(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(OUTBOX_KEY);
}