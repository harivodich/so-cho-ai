import { createHash } from "node:crypto";
import { AppHttpError } from "@/server/http/errors";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/server/observability/logger";

export type IdempotencyRecord<T> = {
  requestHash: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  status?: "in_flight" | "completed";
};

type InFlightEntry = {
  requestHash: string;
  promise: Promise<unknown>;
  startedAt: number;
};

const memoryCache = new Map<string, IdempotencyRecord<unknown>>();
const memoryInFlight = new Map<string, InFlightEntry>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isDistributedStoreEnabled(): boolean {
  if (process.env.NODE_ENV === "test" && !process.env.TEST_DISTRIBUTED_IDEMPOTENCY) {
    return false;
  }
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_CLOUD_PROJECT,
  );
}

export function computeRequestHash(payload: unknown): string {
  if (payload === undefined || payload === null) return "empty_payload";
  try {
    if (typeof payload === "string") {
      return createHash("sha256").update(payload).digest("hex");
    }
    if (Buffer.isBuffer(payload)) {
      return createHash("sha256").update(payload).digest("hex");
    }
    const serialized = JSON.stringify(payload);
    return createHash("sha256").update(serialized).digest("hex");
  } catch {
    return createHash("sha256").update(String(payload)).digest("hex");
  }
}

function cleanStaleMemoryRecords() {
  const now = Date.now();
  for (const [key, record] of memoryCache.entries()) {
    if (now >= record.expiresAt) {
      memoryCache.delete(key);
    }
  }
  for (const [key, entry] of memoryInFlight.entries()) {
    if (now - entry.startedAt > 60_000) {
      memoryInFlight.delete(key);
    }
  }
}

export type IdempotencyOptions = {
  userId?: string | null;
  route?: string;
  key?: string | null;
  payload?: unknown;
  ttlMs?: number;
};

async function getDistributedRecord(scopedKey: string): Promise<IdempotencyRecord<unknown> | null> {
  if (!isDistributedStoreEnabled()) return null;
  try {
    const db = getFirebaseAdminDb();
    const doc = await db.collection("idempotency_records").doc(scopedKey).get();
    if (!doc.exists) return null;
    return doc.data() as IdempotencyRecord<unknown>;
  } catch {
    return null;
  }
}

async function saveDistributedRecord<T>(scopedKey: string, record: IdempotencyRecord<T>): Promise<void> {
  if (!isDistributedStoreEnabled()) return;
  try {
    const db = getFirebaseAdminDb();
    await db.collection("idempotency_records").doc(scopedKey).set(record);
  } catch {
    // Graceful fallback
  }
}

export async function withIdempotency<T>(
  optionsOrKey: IdempotencyOptions | string | null | undefined,
  operation: () => Promise<T>,
): Promise<{ cached: boolean; data: T }> {
  const options: IdempotencyOptions =
    typeof optionsOrKey === "string" ? { key: optionsOrKey } : optionsOrKey ?? {};

  const clientKey = options.key?.trim();
  if (!clientKey) {
    const result = await operation();
    return { cached: false, data: result };
  }

  const userId = options.userId ? options.userId.trim() : "anonymous";
  const route = options.route ? options.route.trim() : "general";
  const rawKey = `idempotency_${userId}_${route}_${clientKey}`;
  const scopedKey = rawKey.replace(/[/\\#?]/g, "_").slice(0, 150);
  const currentRequestHash = computeRequestHash(options.payload);
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  cleanStaleMemoryRecords();

  // 1. Synchronously check in-flight concurrent execution (Instant lock detection)
  const activeInFlight = memoryInFlight.get(scopedKey);
  if (activeInFlight) {
    if (activeInFlight.requestHash !== currentRequestHash) {
      logger.warn("Concurrent idempotency key reused with different payload", {
        scopedKey,
        currentRequestHash,
        inFlightHash: activeInFlight.requestHash,
      });
      throw new AppHttpError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác trong một tác vụ đang chạy.",
      );
    }
    const data = (await activeInFlight.promise) as T;
    return { cached: true, data };
  }

  // 2. Synchronously check local memory cache
  const localCached = memoryCache.get(scopedKey);
  if (localCached && now < localCached.expiresAt) {
    if (localCached.requestHash !== currentRequestHash) {
      throw new AppHttpError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác.",
      );
    }
    return { cached: true, data: localCached.data as T };
  }

  // 3. Set synchronous inFlight lock immediately before ANY async I/O
  let isFromCache = false;
  const executionPromise = (async (): Promise<T> => {
    // Check distributed Firestore cache if available
    const distributedCached = await getDistributedRecord(scopedKey);
    if (distributedCached && Date.now() < distributedCached.expiresAt) {
      if (distributedCached.requestHash !== currentRequestHash) {
        throw new AppHttpError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác.",
        );
      }
      isFromCache = true;
      memoryCache.set(scopedKey, distributedCached);
      return distributedCached.data as T;
    }

    const data = await operation();
    const completedRecord: IdempotencyRecord<T> = {
      requestHash: currentRequestHash,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      status: "completed",
    };
    memoryCache.set(scopedKey, completedRecord);
    void saveDistributedRecord(scopedKey, completedRecord);
    return data;
  })();

  memoryInFlight.set(scopedKey, {
    requestHash: currentRequestHash,
    promise: executionPromise,
    startedAt: now,
  });

  try {
    const data = await executionPromise;
    return { cached: isFromCache, data };
  } finally {
    memoryInFlight.delete(scopedKey);
  }
}

export function clearIdempotencyCache(): void {
  memoryCache.clear();
  memoryInFlight.clear();
}
