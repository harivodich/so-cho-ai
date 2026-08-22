import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasFirebaseAdmin = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_CONFIG,
  );

  const ready = hasGeminiKey && hasFirebaseAdmin;
  const status = ready ? 200 : 503;

  return NextResponse.json(
    {
      ready,
      services: {
        gemini: hasGeminiKey,
        firebaseAdmin: hasFirebaseAdmin,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
