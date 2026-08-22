import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin-credentials";

export const runtime = "nodejs";

export async function GET() {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasFirebaseAdmin = isFirebaseAdminConfigured();

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
