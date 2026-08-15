import type { NextConfig } from "next";

type BuildEnvironment = Record<string, string | undefined>;

export function createNextConfig(environment: BuildEnvironment = process.env): NextConfig {
  // `standalone` is required by the Dockerfile, but conflicts with Vercel's
  // Next.js build adapter and its own output-file tracing.
  if (environment.VERCEL === "1" || environment.VERCEL_ENV) {
    return {};
  }

  return { output: "standalone" };
}

export default createNextConfig();
