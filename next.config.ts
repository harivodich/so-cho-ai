import type { NextConfig } from "next";

type BuildEnvironment = Record<string, string | undefined>;

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: blob: https:;
  media-src 'self' blob: data:;
  connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://*.google.com;
  frame-src 'self' https://*.firebaseapp.com https://*.google.com;
  frame-ancestors 'none';
`.replace(/\s{2,}/g, " ").trim();

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
  {
    key: "Content-Security-Policy",
    value: cspHeader,
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
