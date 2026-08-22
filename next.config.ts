import type { NextConfig } from "next";

type BuildEnvironment = Record<string, string | undefined>;

export const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
];

export function createNextConfig(environment: BuildEnvironment = process.env): NextConfig {
  const baseConfig: NextConfig = {
    async headers() {
      return [
        {
          source: "/:path*",
          headers: securityHeaders,
        },
      ];
    },
  };

  // `standalone` is required by the Dockerfile, but conflicts with Vercel's
  // Next.js build adapter and its own output-file tracing.
  if (environment.VERCEL === "1" || environment.VERCEL_ENV) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    output: "standalone",
  };
}

export default createNextConfig();
