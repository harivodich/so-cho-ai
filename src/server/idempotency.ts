type IdempotencyRecord<T> = {
  data: T;
  createdAt: number;
};

const cache = new Map<string, IdempotencyRecord<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanStaleRecords() {
  const now = Date.now();
  for (const [key, record] of cache.entries()) {
    if (now - record.createdAt > DEFAULT_TTL_MS) {
      cache.delete(key);
    }
  }
}

export async function withIdempotency<T>(
  key: string | null | undefined,
  operation: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<{ cached: boolean; data: T }> {
  if (!key || typeof key !== "string" || key.trim().length === 0) {
    const result = await operation();
    return { cached: false, data: result };
  }

  const cleanKey = `idem:${key.trim().slice(0, 128)}`;

  // 1. Check existing cached response
  const cached = cache.get(cleanKey);
  if (cached && Date.now() - cached.createdAt <= ttlMs) {
    return { cached: true, data: cached.data as T };
  }

  // 2. Check if the exact same operation is already running (deduplicate concurrent in-flight calls)
  const activePromise = inFlight.get(cleanKey);
  if (activePromise) {
    const data = (await activePromise) as T;
    return { cached: true, data };
  }

  // 3. Run operation and cache result
  cleanStaleRecords();
  const promise = operation();
  inFlight.set(cleanKey, promise);

  try {
    const data = await promise;
    cache.set(cleanKey, { data, createdAt: Date.now() });
    return { cached: false, data };
  } finally {
    inFlight.delete(cleanKey);
  }
}
