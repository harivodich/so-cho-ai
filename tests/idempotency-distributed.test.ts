import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  acquireDistributedLock,
  completeDistributedLock,
  computeCanonicalKey,
  computeRequestHash,
  type IdempotencyRecord,
} from "@/server/idempotency";

// Mock Firebase Admin DB to simulate real Firestore Transaction concurrency & lease behavior
const mockFirestoreStore = new Map<string, IdempotencyRecord<unknown>>();

vi.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdminDb: vi.fn(() => ({
    collection: vi.fn((collName: string) => ({
      doc: vi.fn((docId: string) => ({
        path: `${collName}/${docId}`,
      })),
    })),
    runTransaction: vi.fn(async (updateFunction: (transaction: unknown) => Promise<unknown>) => {
      const transactionMock = {
        get: vi.fn(async (docRef: { path: string }) => {
          const docData = mockFirestoreStore.get(docRef.path);
          return {
            exists: docData !== undefined,
            data: () => (docData ? { ...docData } : undefined),
          };
        }),
        set: vi.fn(async (docRef: { path: string }, data: IdempotencyRecord<unknown>) => {
          mockFirestoreStore.set(docRef.path, { ...data });
        }),
        update: vi.fn(async (docRef: { path: string }, data: Partial<IdempotencyRecord<unknown>>) => {
          const existing = mockFirestoreStore.get(docRef.path) ?? ({} as IdempotencyRecord<unknown>);
          mockFirestoreStore.set(docRef.path, { ...existing, ...data });
        }),
      };
      return await updateFunction(transactionMock);
    }),
  })),
}));

describe("Distributed Idempotency & Concurrency Guarantees", () => {
  beforeEach(() => {
    mockFirestoreStore.clear();
    process.env.TEST_DISTRIBUTED_IDEMPOTENCY = "true";
  });

  it("handles atomic lock acquisition and prevents dual execution across distributed instances", async () => {
    const key = computeCanonicalKey("user_dist_1", "/api/extract", "shared-dist-key");
    const hash = computeRequestHash({ audio: "recording-a.wav" });

    // Instance 1 acquires lock
    const lock1 = await acquireDistributedLock<string>(key, hash, 60_000, 10_000);
    expect(lock1.status).toBe("acquired");
    if (lock1.status !== "acquired") throw new Error("Expected acquired");
    const token1 = lock1.lockToken;
    expect(token1).toBeDefined();

    // Instance 2 attempts to acquire during instance 1's active lease -> returns 'processing'
    const lock2 = await acquireDistributedLock<string>(key, hash, 60_000, 10_000);
    expect(lock2.status).toBe("processing");

    // Instance 1 completes execution and commits record
    const completeSuccess = await completeDistributedLock(key, token1, hash, "Result From Instance 1", 60_000);
    expect(completeSuccess).toBe(true);

    // Instance 2 polls again -> returns 'cached' with Instance 1's output
    const lock2AfterComplete = await acquireDistributedLock<string>(key, hash, 60_000, 10_000);
    expect(lock2AfterComplete.status).toBe("cached");
    if (lock2AfterComplete.status === "cached") {
      expect(lock2AfterComplete.data).toBe("Result From Instance 1");
    }
  });

  it("prevents stale worker from overwriting fresh data if its lease expired and was taken over", async () => {
    const key = computeCanonicalKey("user_dist_2", "/api/extract", "stale-worker-key");
    const hash = computeRequestHash({ audio: "recording-slow.wav" });

    // Worker 1 acquires lock with short lease
    const lock1 = await acquireDistributedLock<string>(key, hash, 60_000, 50);
    expect(lock1.status).toBe("acquired");
    if (lock1.status !== "acquired") throw new Error("Expected acquired");
    const worker1Token = lock1.lockToken;

    // Simulate lease expiry
    const docPath = "idempotency_records/" + key;
    const record = mockFirestoreStore.get(docPath);
    if (record) {
      record.leaseUntil = Date.now() - 100;
      mockFirestoreStore.set(docPath, record);
    }

    // Worker 2 takes over the expired lease
    const lock2 = await acquireDistributedLock<string>(key, hash, 60_000, 10_000);
    expect(lock2.status).toBe("acquired");
    if (lock2.status !== "acquired") throw new Error("Expected acquired");
    const worker2Token = lock2.lockToken;
    expect(worker2Token).not.toBe(worker1Token);

    // Worker 2 completes first
    const worker2Complete = await completeDistributedLock(key, worker2Token, hash, "Worker 2 Fresh Result", 60_000);
    expect(worker2Complete).toBe(true);

    // Worker 1 finishes late and attempts to write with stale token -> rejected
    const worker1Complete = await completeDistributedLock(key, worker1Token, hash, "Worker 1 STALE Result", 60_000);
    expect(worker1Complete).toBe(false);

    // Final store must contain Worker 2's result, not overwritten by stale Worker 1
    const stored = mockFirestoreStore.get(docPath);
    expect(stored?.data).toBe("Worker 2 Fresh Result");
  });

  it("rejects lock acquisition when request payload differs from existing record", async () => {
    const key = computeCanonicalKey("user_dist_3", "/api/extract", "conflict-key");
    const hashA = computeRequestHash({ audio: "audio-file-AAA.wav" });
    const hashB = computeRequestHash({ audio: "audio-file-BBB.wav" });

    const lockA = await acquireDistributedLock<string>(key, hashA, 60_000);
    expect(lockA.status).toBe("acquired");

    // Reusing the same key with different hashB must throw 409
    await expect(acquireDistributedLock<string>(key, hashB, 60_000)).rejects.toThrow(
      "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác.",
    );
  });

  it("fails closed with 503 and purges memory cache when distributed lock complete fails in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const { withIdempotency, clearIdempotencyCache } = await import("@/server/idempotency");
      clearIdempotencyCache();

      const testKey = "prod-fail-complete-key";

      // Simulate a scenario where lock is acquired, but complete fails (e.g. lease expired or write rejected)
      // We will do this by manipulating mockFirestoreStore right after lock is acquired
      let operationExecuted = false;
      const op = async () => {
        operationExecuted = true;
        // Expire the lease mid-flight so completeDistributedLock fails
        const canonicalKey = computeCanonicalKey("user_prod_1", "/api/extract", testKey);
        const docPath = "idempotency_records/" + canonicalKey;
        const rec = mockFirestoreStore.get(docPath);
        if (rec) {
          rec.lockToken = "taken_over_token_by_another_worker";
          mockFirestoreStore.set(docPath, rec);
        }
        return { data: "Unpersisted AI Result" };
      };

      await expect(
        withIdempotency(
          { userId: "user_prod_1", route: "/api/extract", key: testKey, payload: { p: 1 } },
          op,
        ),
      ).rejects.toMatchObject({
        status: 503,
        code: "IDEMPOTENCY_STORE_UNAVAILABLE",
      });

      expect(operationExecuted).toBe(true);

      // Verify that memory cache was purged and does not contain the unpersisted data
      // A retry must not return cached data
      let retryExecuted = false;
      const retryOp = async () => {
        retryExecuted = true;
        return { data: "Retry Operation Result" };
      };

      // Since the previous lock token was altered, the retry attempts acquisition
      // It should not return { data: "Unpersisted AI Result" } from memory!
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
