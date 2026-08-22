import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const buildSha =
    process.env.NEXT_PUBLIC_BUILD_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    "development";
  const buildTime = process.env.BUILD_TIME || new Date().toISOString();
  const version = "0.1.0";

  return NextResponse.json(
    {
      status: "ok",
      version,
      buildSha,
      buildTime,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
