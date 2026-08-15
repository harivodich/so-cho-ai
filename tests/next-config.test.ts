import { describe, expect, it } from "vitest";

import { createNextConfig } from "../next.config";

describe("createNextConfig", () => {
  it("keeps standalone output for the Docker deployment path", () => {
    expect(createNextConfig({})).toEqual({ output: "standalone" });
  });

  it("lets Vercel manage Next.js output tracing", () => {
    expect(createNextConfig({ VERCEL: "1" })).toEqual({});
    expect(createNextConfig({ VERCEL_ENV: "production" })).toEqual({});
  });
});
