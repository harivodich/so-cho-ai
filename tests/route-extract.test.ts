import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/extract/route";
import { clearIdempotencyCache } from "@/server/idempotency";

vi.mock("@/server/auth/require-user", () => ({
  requireAuthenticatedUser: vi.fn(async (request: Request) => {
    const auth = request.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      const { AppHttpError } = await import("@/server/http/errors");
      throw new AppHttpError(401, "UNAUTHORIZED", "Bạn cần đăng nhập để dùng trích xuất AI.");
    }
    if (auth.includes("anonymous-token")) {
      const { AppHttpError } = await import("@/server/http/errors");
      throw new AppHttpError(403, "FORBIDDEN", "Hãy đăng nhập tài khoản thật trước khi dùng tính năng này.");
    }
    return { uid: "user_test_route", email: "user@example.com", isAnonymous: false };
  }),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        collection: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => ({ docs: [] })),
            })),
          })),
        })),
      })),
    })),
  })),
  getFirebaseAdminAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(async () => ({ uid: "user_test_route" })),
  })),
}));

vi.mock("@/lib/extraction/quota", () => ({
  enforceExtractionQuota: vi.fn(async (uid: string) => {
    if (uid === "user_quota_exceeded") {
      const { ExtractionQuotaError } = await import("@/lib/extraction/quota");
      throw new ExtractionQuotaError("Hôm nay bạn đã dùng hết số lượt trích xuất.");
    }
  }),
  vietnamDateKey: vi.fn(() => "2026-08-22"),
  ExtractionQuotaError: class extends Error {},
}));

vi.mock("@/server/ai/service", () => ({
  aiApplicationService: {
    extractAudio: vi.fn(async () => ({
      drafts: [
        {
          type: "sale",
          itemName: "Thanh Long",
          canonicalItemName: "thanh long",
          quantity: 5,
          unit: "kg",
          unitPrice: 20000,
          amount: 100000,
          occurredAt: "2026-08-22",
          rawInput: "Bán 5 ký thanh long 100k",
          fieldsNeedingReview: [],
          missingFields: [],
          warnings: [],
        },
      ],
      run: {
        mode: "voice",
        model: "gemini-2.5-flash",
        promptVersion: "text-extraction-v2",
        latencyMs: 150,
      },
    })),
    extractImage: vi.fn(async () => ({
      drafts: [
        {
          type: "purchase",
          itemName: "Thùng xốp",
          canonicalItemName: "thung xop",
          quantity: 10,
          unit: "cái",
          unitPrice: 25000,
          amount: 250000,
          occurredAt: "2026-08-22",
          rawInput: "Hóa đơn thùng xốp 250k",
          fieldsNeedingReview: [],
          missingFields: [],
          warnings: [],
        },
      ],
      run: {
        mode: "image",
        model: "gemini-2.5-flash",
        promptVersion: "image-extraction-v1",
        latencyMs: 300,
      },
    })),
  },
}));

describe("Route Integration: /api/extract", () => {
  beforeEach(() => {
    clearIdempotencyCache();
    vi.clearAllMocks();
  });

  it("returns 401 when request is unauthenticated", async () => {
    const formData = new FormData();
    formData.set("mode", "voice");
    formData.set("audio", new File(["sample audio"], "sample.wav", { type: "audio/wav" }));

    const req = new Request("http://localhost/api/extract", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toEqual(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: expect.any(String),
        requestId: expect.any(String),
      }),
    );
  });

  it("returns 400 when mode is invalid", async () => {
    const formData = new FormData();
    formData.set("mode", "invalid_mode");

    const req = new Request("http://localhost/api/extract", {
      method: "POST",
      headers: { Authorization: "Bearer valid_token" },
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toEqual(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: expect.any(String),
        requestId: expect.any(String),
      }),
    );
  });

  it("returns 200 with structured drafts and metadata for valid voice audio", async () => {
    const formData = new FormData();
    formData.set("mode", "voice");
    formData.set("audio", new File(["audio bytes content 123"], "rec.wav", { type: "audio/wav" }));

    const req = new Request("http://localhost/api/extract", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid_token",
        "Idempotency-Key": "unique-voice-route-key-1",
      },
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drafts).toBeDefined();
    expect(body.drafts.length).toBe(1);
    expect(body.drafts[0].itemName).toBe("Thanh Long");
    expect(body.metadata).toBeDefined();
    expect(body.metadata.mode).toBe("voice");
  });

  it("deduplicates identical requests and returns cached extraction result", async () => {
    const formData1 = new FormData();
    formData1.set("mode", "voice");
    formData1.set("audio", new File(["identical audio content"], "rec.wav", { type: "audio/wav" }));

    const formData2 = new FormData();
    formData2.set("mode", "voice");
    formData2.set("audio", new File(["identical audio content"], "rec.wav", { type: "audio/wav" }));

    const key = "reused-dedup-key-123";

    const res1 = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { Authorization: "Bearer valid_token", "Idempotency-Key": key },
        body: formData1,
      }),
    );
    expect(res1.status).toBe(200);

    const res2 = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { Authorization: "Bearer valid_token", "Idempotency-Key": key },
        body: formData2,
      }),
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.drafts[0].itemName).toBe("Thanh Long");
  });

  it("rejects with 409 when the same idempotency key is reused with a different file", async () => {
    const formDataA = new FormData();
    formDataA.set("mode", "voice");
    formDataA.set("audio", new File(["file content AAAAAA"], "rec.wav", { type: "audio/wav" }));

    const formDataB = new FormData();
    formDataB.set("mode", "voice");
    formDataB.set("audio", new File(["file content BBBBBB"], "rec.wav", { type: "audio/wav" }));

    const sharedKey = "shared-clashing-key-abc";

    const resA = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { Authorization: "Bearer valid_token", "Idempotency-Key": sharedKey },
        body: formDataA,
      }),
    );
    expect(resA.status).toBe(200);

    const resB = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { Authorization: "Bearer valid_token", "Idempotency-Key": sharedKey },
        body: formDataB,
      }),
    );
    expect(resB.status).toBe(409);
    const bodyB = await resB.json();
    expect(bodyB.error).toEqual(
      expect.objectContaining({
        code: "IDEMPOTENCY_KEY_REUSED",
        message: expect.stringContaining("Khóa Idempotency đã được sử dụng"),
        requestId: expect.any(String),
      }),
    );
  });
});
