import { createHash } from "node:crypto";
import { AppHttpError } from "@/server/http/errors";

export type IdempotencyRecord<T> = {
  requestHash: string;
  data: T;
  createdAt: number;
  expiresAt: number;
};

const cache = new Map<string, IdempotencyRecord<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function computeRequestHash(payload: unknown): string {
  if (payload === undefined || payload === null) return "empty_payload";
  try {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
    return createHash("sha256").update(serialized).digest("hex").slice(0, 32);
  } catch {
    return createHash("sha256").update(String(payload)).digest("hex").slice(0, 32);
  }
}

function cleanStaleRecords() {
  const now = Date.now();
  for (const [key, record] of cache.entries()) {
    if (now >= record.expiresAt) {
      cache.delete(key);
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
  const scopedKey = `idempotency:${userId}:${route}:${clientKey.slice(0, 128)}`;
  const currentRequestHash = computeRequestHash(options.payload);
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  // 1. Check existing cached response
  const cached = cache.get(scopedKey);
  if (cached && now < cached.expiresAt) {
    if (cached.requestHash !== currentRequestHash) {
      throw new AppHttpError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác.",
      );
    }
    return { cached: true, data: cached.data as T };
  }

  // 2. Check if the exact same operation is already running (deduplicate concurrent in-flight calls)
  const activePromise = inFlight.get(scopedKey);
  if (activePromise) {
    const data = (await activePromise) as T;
    return { cached: true, data };
  }

  // 3. Run operation and cache only on successful completion
  cleanStaleRecords();
  const promise = (async () => {
    const data = await operation();
    cache.set(scopedKey, {
      requestHash: currentRequestHash,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
    return data;
  })();

  inFlight.set(scopedKey, promise);

  try {
    const data = await promise;
    return { cached: false, data };
  } finally {
    inFlight.delete(scopedKey);
  }
}

export function clearIdempotencyCache(): void {
  cache.clear();
  inFlight.clear();
}
