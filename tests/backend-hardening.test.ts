import { describe, expect, it } from "vitest";
import { AppHttpError, createErrorResponse } from "@/server/http/errors";
import { extractOrGenerateRequestId } from "@/server/http/request-id";
import { hashUserId, sanitizeLogData } from "@/server/observability/logger";
import { withIdempotency } from "@/server/idempotency";

describe("backend hardening & observability", () => {
  it("extracts or generates a clean request ID", () => {
    const reqWithHeader = new Request("http://localhost/api/test", {
      headers: { "x-request-id": "client-req-12345" },
    });
    expect(extractOrGenerateRequestId(reqWithHeader)).toBe("client-req-12345");

    const reqWithoutHeader = new Request("http://localhost/api/test");
    const generated = extractOrGenerateRequestId(reqWithoutHeader);
    expect(typeof generated).toBe("string");
    expect(generated.length).toBeGreaterThan(10);
  });

  it("formats standard structured error responses", async () => {
    const appError = new AppHttpError(429, "QUOTA_EXCEEDED", "Đã hết quota.");
    const response = createErrorResponse(appError, "req-999");
    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: { code: string; message: string; requestId: string } };
    expect(body.error.code).toBe("QUOTA_EXCEEDED");
    expect(body.error.message).toBe("Đã hết quota.");
    expect(body.error.requestId).toBe("req-999");
  });

  it("hashes user ID for privacy-safe logging without leaking raw UID", () => {
    const uid = "user_secret_uid_abc123";
    const hashed = hashUserId(uid);
    expect(hashed).not.toContain("secret");
    expect(hashed.length).toBe(16);
    expect(hashUserId(uid)).toBe(hashed); // deterministic
  });

  it("redacts sensitive fields in log contexts", () => {
    const context = {
      route: "/api/extract",
      apiKey: "AIzaSySecretApiKey123456789012345",
      audioBase64: "dGVzdGF1ZGlvYnl0ZXNsb25nc3RyaW5nMTIzNDU2Nzg5MA==",
      userId: "u123",
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
    let executionCount = 0;
    const slowTask = async () => {
      executionCount += 1;
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
});
