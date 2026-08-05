import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const configured = Object.values(config).every(Boolean);

  return NextResponse.json(
    configured ? { configured: true, firebase: config } : { configured: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
