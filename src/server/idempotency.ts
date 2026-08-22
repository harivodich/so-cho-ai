import { createHash } from "node:crypto";
import { AppHttpError } from "@/server/http/errors";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/server/observability/logger";

export type IdempotencyRecord<T> = {
  requestHash: string;
  data?: T;
  createdAt: number;
  expiresAt: number;
  status: "processing" | "completed" | "failed";
  leaseUntil?: number;
  lockToken?: string;
  ownerId?: string;
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
  if (process.env.TEST_DISTRIBUTED_IDEMPOTENCY === "true") {
    return true;
  }
  if (process.env.NODE_ENV === "test") {
    return false;
  }
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_CLOUD_PROJECT,
  );
}

export function computeCanonicalKey(
  userId: string | null | undefined,
  route: string | undefined,
  clientKey: string,
): string {
  const canonicalTuple = {
    clientKey: clientKey.trim(),
    route: (route ?? "general").trim(),
    userId: (userId ?? "anonymous").trim(),
  };
  return createHash("sha256").update(JSON.stringify(canonicalTuple)).digest("hex");
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

export function validateIdempotencyKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed.length < 1 || trimmed.length > 128) {
    throw new AppHttpError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key phải có độ dài từ 1 đến 128 ký tự.");
  }
  if (!/^[a-zA-Z0-9_\-.:]+$/.test(trimmed)) {
    throw new AppHttpError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key chỉ được chứa ký tự chữ cái, số, gạch nối (-), gạch dưới (_) hoặc dấu chấm (.).");
  }
}

export type LockAcquireResult<T> =
  | { status: "acquired"; lockToken: string }
  | { status: "cached"; data: T }
  | { status: "processing" };

export async function acquireDistributedLock<T>(
  scopedKey: string,
  requestHash: string,
  ttlMs: number,
  leaseMs = 30_000,
): Promise<LockAcquireResult<T>> {
  if (!isDistributedStoreEnabled()) {
    const memoryToken = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { status: "acquired", lockToken: memoryToken };
  }
  try {
    const db = getFirebaseAdminDb();
    const docRef = db.collection("idempotency_records").doc(scopedKey);
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const now = Date.now();
      const newLockToken = `tok_${now}_${Math.random().toString(36).slice(2)}`;

      if (!doc.exists) {
        transaction.set(docRef, {
          requestHash,
          status: "processing",
          lockToken: newLockToken,
          ownerId: newLockToken,
          createdAt: now,
          expiresAt: now + ttlMs,
          leaseUntil: now + leaseMs,
        });
        return { status: "acquired", lockToken: newLockToken };
      }

      const data = doc.data() as IdempotencyRecord<T>;
      if (data.requestHash !== requestHash) {
        throw new AppHttpError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác.",
        );
      }

      if (data.status === "completed" && now < data.expiresAt && data.data !== undefined) {
        return { status: "cached", data: data.data };
      }

      if (data.status === "processing" && data.leaseUntil && now < data.leaseUntil) {
        return { status: "processing" };
      }

      // Lease expired or failed: safe takeover with new lockToken
      transaction.update(docRef, {
        requestHash,
        status: "processing",
        lockToken: newLockToken,
        ownerId: newLockToken,
        leaseUntil: now + leaseMs,
        expiresAt: now + ttlMs,
      });
      return { status: "acquired", lockToken: newLockToken };
    });
  } catch (err) {
    if (err instanceof AppHttpError) throw err;
    logger.warn("Distributed idempotency transaction unavailable", {
      error: err instanceof Error ? err.message : String(err),
    });
    if (process.env.NODE_ENV === "production") {
      throw new AppHttpError(
        503,
        "IDEMPOTENCY_STORE_UNAVAILABLE",
        "Hệ thống kiểm soát giao dịch trùng lặp tạm thời không khả dụng. Vui lòng thử lại sau.",
      );
    }
    const fallbackToken = `fb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { status: "acquired", lockToken: fallbackToken };
  }
}

export async function completeDistributedLock<T>(
  scopedKey: string,
  lockToken: string,
  requestHash: string,
  data: T,
  ttlMs: number,
): Promise<boolean> {
  if (!isDistributedStoreEnabled()) return true;
  try {
    const db = getFirebaseAdminDb();
    const docRef = db.collection("idempotency_records").doc(scopedKey);
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) return false;
      const record = doc.data() as IdempotencyRecord<T>;
      // Stale writer guard: verify lockToken ownership
      if (record.lockToken && record.lockToken !== lockToken) {
        logger.warn("Stale worker attempted to complete idempotency record after lease takeover", {
          scopedKey: scopedKey.slice(0, 16),
          workerToken: lockToken,
          currentOwnerToken: record.lockToken,
        });
        return false;
      }
      const now = Date.now();
      transaction.update(docRef, {
        status: "completed",
        data,
        completedAt: now,
        expiresAt: now + ttlMs,
      });
      return true;
    });
  } catch (err) {
    logger.warn("Failed to persist completed distributed idempotency record", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function failDistributedLock(scopedKey: string, lockToken?: string): Promise<void> {
  if (!isDistributedStoreEnabled()) return;
  try {
    const db = getFirebaseAdminDb();
    const docRef = db.collection("idempotency_records").doc(scopedKey);
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) return;
      const record = doc.data() as IdempotencyRecord<unknown>;
      if (lockToken && record.lockToken && record.lockToken !== lockToken) {
        return; // Lease already taken over, do not overwrite
      }
      transaction.update(docRef, {
        status: "failed",
        leaseUntil: 0,
      });
    });
  } catch {
    // Non-blocking cleanup
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

  validateIdempotencyKey(clientKey);

  const userId = options.userId ? options.userId.trim() : "anonymous";
  const route = options.route ? options.route.trim() : "general";
  const scopedKey = computeCanonicalKey(userId, route, clientKey);
  const currentRequestHash = computeRequestHash(options.payload);
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  cleanStaleMemoryRecords();

  // 1. Synchronously check in-flight concurrent execution (Instant memory lock)
  const activeInFlight = memoryInFlight.get(scopedKey);
  if (activeInFlight) {
    if (activeInFlight.requestHash !== currentRequestHash) {
      logger.warn("Concurrent idempotency key reused with different payload", {
        scopedKey: scopedKey.slice(0, 16),
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
  if (localCached && localCached.status === "completed" && now < localCached.expiresAt) {
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
    // 3a. Acquire Atomic Distributed Lock via Firestore Transaction if configured
    let lockResult = await acquireDistributedLock<T>(scopedKey, currentRequestHash, ttlMs);
    if (lockResult.status === "cached") {
      isFromCache = true;
      memoryCache.set(scopedKey, {
        requestHash: currentRequestHash,
        data: lockResult.data,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        status: "completed",
      });
      return lockResult.data;
    }

    // If another instance holds an active lease, poll with bounded backoff
    if (lockResult.status === "processing") {
      const maxPollAttempts = 5;
      const pollDelayMs = 600;
      for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
        lockResult = await acquireDistributedLock<T>(scopedKey, currentRequestHash, ttlMs);
        if (lockResult.status === "cached") {
          isFromCache = true;
          memoryCache.set(scopedKey, {
            requestHash: currentRequestHash,
            data: lockResult.data,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
            status: "completed",
          });
          return lockResult.data;
        }
        if (lockResult.status === "acquired") {
          break; // Lease expired and was successfully acquired by this instance
        }
      }

      // If still processing by another instance, reject cleanly with IDEMPOTENCY_IN_PROGRESS
      if (lockResult.status === "processing") {
        throw new AppHttpError(
          409,
          "IDEMPOTENCY_IN_PROGRESS",
          "Yêu cầu tương tự đang được xử lý bởi hệ thống. Vui lòng thử lại sau giây lát.",
        );
      }
    }

    const acquiredToken = lockResult.status === "acquired" ? lockResult.lockToken : "";

    try {
      const data = await operation();
      const completedRecord: IdempotencyRecord<T> = {
        requestHash: currentRequestHash,
        data,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        status: "completed",
        lockToken: acquiredToken,
      };
      memoryCache.set(scopedKey, completedRecord);
      await completeDistributedLock(scopedKey, acquiredToken, currentRequestHash, data, ttlMs);
      return data;
    } catch (opError) {
      await failDistributedLock(scopedKey, acquiredToken);
      throw opError;
    }
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
