import { describe, expect, it } from "vitest";
import { extractOrGenerateRequestId } from "@/server/http/request-id";
import { AppHttpError, createErrorResponse } from "@/server/http/errors";
import { sanitizeLogData, hashUserId } from "@/server/observability/logger";
import { withIdempotency, clearIdempotencyCache } from "@/server/idempotency";

describe("backend hardening & observability", () => {
  it("extracts or generates a clean request ID", () => {
    const customReq = new Request("http://localhost/api/extract", {
      headers: { "x-request-id": "req-custom-12345" },
    });
    expect(extractOrGenerateRequestId(customReq)).toBe("req-custom-12345");

    const fallbackReq = new Request("http://localhost/api/extract");
    const generated = extractOrGenerateRequestId(fallbackReq);
    expect(generated).toBeDefined();
    expect(generated.length).toBeGreaterThan(8);
  });

  it("formats standard structured error responses", async () => {
    const error = new AppHttpError(429, "QUOTA_EXCEEDED", "Bạn đã dùng hết hạn mức AI trong ngày.", {
      limit: 30,
      used: 30,
    });
    const response = createErrorResponse(error, "req-test-999");
    expect(response.status).toBe(429);
    expect(response.headers.get("x-request-id")).toBe("req-test-999");

    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("QUOTA_EXCEEDED");
    expect(body.error.message).toContain("hết hạn mức");
    expect(body.error.requestId).toBe("req-test-999");
    expect(body.error.details.limit).toBe(30);
  });

  it("hashes user ID for privacy-safe logging without leaking raw UID", () => {
    const rawUid = "user_firebase_raw_123456";
    const hashed = hashUserId(rawUid);
    expect(hashed).not.toBe(rawUid);
    expect(hashed).toMatch(/^usr_[a-f0-9]{16}$/);
    expect(hashUserId(null)).toBe("anonymous");
  });

  it("redacts sensitive fields in log contexts", () => {
    const context = {
      apiKey: "AIzaSySecretApiKey1234567890",
      audioBase64: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8USAElUZT1AeeU27q5n",
      route: "/api/extract",
      nested: {
        token: "bearer-token-12345",
        status: 200,
      },
    };
    const sanitized = sanitizeLogData(context);
    expect(sanitized.route).toBe("/api/extract");
    expect(String(sanitized.apiKey)).toContain("[REDACTED");
    expect(String(sanitized.audioBase64)).toContain("[REDACTED");
    expect((sanitized.nested as Record<string, unknown>).status).toBe(200);
    expect(String((sanitized.nested as Record<string, unknown>).token)).toContain("[REDACTED");
  });

  it("deduplicates concurrent requests and caches with idempotency key", async () => {
    clearIdempotencyCache();
    let executionCount = 0;
    const slowTask = async () => {
      executionCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { result: "ok", count: executionCount };
    };

    const key = `test-idem-${Date.now()}`;
    const [res1, res2] = await Promise.all([
      withIdempotency(key, slowTask),
      withIdempotency(key, slowTask),
    ]);

    expect(executionCount).toBe(1);
    expect(res1.data).toEqual(res2.data);
  });

  it("isolates idempotency caches across different users with identical keys", async () => {
    clearIdempotencyCache();
    const sharedClientKey = "shared-uuid-key";

    const userATask = async () => ({ user: "userA", secret: "dataA" });
    const userBTask = async () => ({ user: "userB", secret: "dataB" });

    const resA = await withIdempotency(
      { userId: "uid_user_A", route: "/api/extract", key: sharedClientKey, payload: { mode: "voice" } },
      userATask,
    );
    const resB = await withIdempotency(
      { userId: "uid_user_B", route: "/api/extract", key: sharedClientKey, payload: { mode: "voice" } },
      userBTask,
    );

    expect(resA.data.user).toBe("userA");
    expect(resB.data.user).toBe("userB");
    expect(resA.data).not.toEqual(resB.data);
  });

  it("rejects idempotency key reuse when payload differs", async () => {
    clearIdempotencyCache();
    const key = "test-reused-key";

    await withIdempotency(
      { userId: "uid_1", route: "/api/extract", key, payload: { audio: "file1" } },
      async () => ({ result: "file1-processed" }),
    );

    await expect(
      withIdempotency(
        { userId: "uid_1", route: "/api/extract", key, payload: { audio: "different-file2" } },
        async () => ({ result: "file2-processed" }),
      ),
    ).rejects.toThrow("Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác.");
  });
});
