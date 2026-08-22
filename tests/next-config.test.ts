import { describe, expect, it } from "vitest";

import { createNextConfig, securityHeaders } from "../next.config";

describe("createNextConfig", () => {
  it("keeps standalone output for the Docker deployment path", () => {
    const config = createNextConfig({});
    expect(config.output).toBe("standalone");
    expect(config.headers).toBeDefined();
  });

  it("lets Vercel manage Next.js output tracing", () => {
    const vercelConfig = createNextConfig({ VERCEL: "1" });
    expect(vercelConfig.output).toBeUndefined();
    expect(vercelConfig.headers).toBeDefined();

    const vercelProdConfig = createNextConfig({ VERCEL_ENV: "production" });
    expect(vercelProdConfig.output).toBeUndefined();
  });

  it("configures security headers for all routes", async () => {
    const config = createNextConfig({});
    if (config.headers) {
      const headersList = await config.headers();
      expect(headersList).toHaveLength(1);
      expect(headersList[0].source).toBe("/:path*");
      expect(headersList[0].headers).toEqual(securityHeaders);
    }
  });
});
