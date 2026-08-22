import { describe, expect, it } from "vitest";
import { GET as healthHandler } from "@/app/api/health/route";
import { GET as readyHandler } from "@/app/api/ready/route";

describe("Health & Readiness Endpoints", () => {
  it("GET /api/health returns 200 with build metadata and version", async () => {
    const response = await healthHandler();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.version).toBe("0.1.0");
    expect(data.buildSha).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  it("GET /api/ready reports readiness status of platform dependencies", async () => {
    const response = await readyHandler();
    expect([200, 503]).toContain(response.status);
    const data = await response.json();
    expect(data.services).toBeDefined();
    expect(typeof data.services.gemini).toBe("boolean");
    expect(typeof data.services.firebaseAdmin).toBe("boolean");
  });
});
