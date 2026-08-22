import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/insights/route";
import { clearIdempotencyCache } from "@/server/idempotency";

vi.mock("@/server/auth/require-user", () => ({
  requireAuthenticatedUser: vi.fn(async (request: Request) => {
    const auth = request.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      const { AppHttpError } = await import("@/server/http/errors");
      throw new AppHttpError(401, "UNAUTHORIZED", "Bạn cần đăng nhập để dùng nhận xét AI.");
    }
    if (auth.includes("anonymous-token")) {
      const { AppHttpError } = await import("@/server/http/errors");
      throw new AppHttpError(403, "FORBIDDEN", "Hãy đăng nhập tài khoản thật trước khi dùng tính năng này.");
    }
    return { uid: "user_test_insight", email: "insight@example.com", isAnonymous: false };
  }),
}));

vi.mock("@/lib/insights/quota", () => ({
  enforceDailyInsightQuota: vi.fn(async () => {}),
  DailyInsightQuotaError: class extends Error {},
}));

vi.mock("@/server/ai/service", () => ({
  aiApplicationService: {
    generateDailyInsight: vi.fn(async () => ({
      insight: {
        summary: "Doanh thu hôm nay đạt 1.500.000 đ, tăng 15% so với hôm qua.",
        observations: ["Mặt hàng Xoài Cát bán chạy nhất.", "Chi phí nhập hàng được kiểm soát tốt."],
        recommendations: ["Tiếp tục nhập thêm xoài vào buổi sáng.", "Theo dõi công nợ khách quen."],
      },
    })),
  },
}));

describe("Route Integration: /api/insights", () => {
  beforeEach(() => {
    clearIdempotencyCache();
    vi.clearAllMocks();
  });

  const validSnapshot = {
    date: "2026-08-22",
    revenue: 1500000,
    purchases: 800000,
    otherExpenses: 100000,
    estimatedCostOfGoods: 800000,
    estimatedGrossProfit: 700000,
    transactionCount: 15,
    saleCount: 12,
    averageSaleValue: 125000,
    missingCostSaleCount: 0,
  };

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validSnapshot),
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

  it("returns 422 when snapshot schema is invalid", async () => {
    const req = new Request("http://localhost/api/insights", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid_token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invalid: "data", missingRequired: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toEqual(
      expect.objectContaining({
        code: "UNPROCESSABLE_ENTITY",
        message: expect.stringContaining("Số liệu tổng hợp không đúng cấu trúc"),
        requestId: expect.any(String),
      }),
    );
  });

  it("returns 200 with structured AI insight for valid snapshot", async () => {
    const req = new Request("http://localhost/api/insights", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid_token",
        "Content-Type": "application/json",
        "Idempotency-Key": "insight-key-12345",
      },
      body: JSON.stringify(validSnapshot),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insight).toBeDefined();
    expect(body.insight.summary).toContain("Doanh thu hôm nay đạt 1.500.000 đ");
    expect(body.insight.observations.length).toBe(2);
    expect(body.insight.recommendations.length).toBe(2);
  });
});
