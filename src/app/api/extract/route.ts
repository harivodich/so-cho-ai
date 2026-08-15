import { NextResponse } from "next/server";

import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";
import { extractTransactionFromAudio, GeminiRequestError } from "@/lib/extraction/gemini";
import { ExtractionQuotaError, enforceExtractionQuota, vietnamDateKey } from "@/lib/extraction/quota";
import { applyDataQualityGuard } from "@/lib/extraction/data-quality";
import { ExtractionValidationError } from "@/lib/extraction/schema";
import { validateAudioUpload } from "@/lib/extraction/audio-validation";

export const runtime = "nodejs";


function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function recentTransactionHistory(userId: string) {
  try {
    const snapshot = await getFirebaseAdminDb()
      .collection("users").doc(userId).collection("transactions")
      .orderBy("occurredAt", "desc").limit(30).get();
    return snapshot.docs.map((document) => {
      const data = document.data();
      return {
        amount: typeof data.amount === "number" ? data.amount : 0,
        type: data.type,
        canonicalItemName: typeof data.canonicalItemName === "string" ? data.canonicalItemName : null,
      };
    }).filter((item) => item.amount > 0 && (item.type === "sale" || item.type === "purchase" || item.type === "expense"));
  } catch {
    return [];
  }
}
async function authenticatedUserId(request: Request): Promise<string | NextResponse> {
  const authorization = request.headers.get("authorization");
  const idToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!idToken) {
    return errorResponse("Bạn cần đăng nhập để dùng trích xuất AI.", 401);
  }

  try {
    return (await getFirebaseAdminAuth().verifyIdToken(idToken, true)).uid;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.startsWith("auth/")) {
      return errorResponse("Phiên đăng nhập không hợp lệ. Hãy tải lại trang.", 401);
    }
    return errorResponse("Không thể xác thực tài khoản trên server lúc này.", 503);
  }
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId(request);
  if (userId instanceof NextResponse) return userId;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Yêu cầu audio không hợp lệ.", 400);
  }

  if (formData.get("mode") !== "voice") {
    return errorResponse("Chỉ hỗ trợ mode voice ở phiên bản này.", 400);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return errorResponse("Chưa nhận được file audio.", 400);
  }
  const audioValidation = validateAudioUpload(audio.size, audio.type);
  if (!audioValidation.valid) {
    return errorResponse(audioValidation.message, audioValidation.status);
  }

  try {
    await enforceExtractionQuota(userId);
    const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const currentDate = vietnamDateKey(new Date());
    const [drafts, history] = await Promise.all([
      extractTransactionFromAudio({ audioBase64, mimeType: audio.type, currentDate }),
      recentTransactionHistory(userId),
    ]);
    const checkedDrafts = drafts.map((draft) => applyDataQualityGuard(draft, { currentDate, history }));
    return NextResponse.json({ drafts: checkedDrafts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtractionQuotaError) return errorResponse(error.message, 429);
    if (error instanceof ExtractionValidationError) return errorResponse(error.message, 422);
    if (error instanceof GeminiRequestError) {
      const status = error.kind === "configuration" ? 503 : error.kind === "quota" ? 429 : 502;
      return errorResponse(error.message, status);
    }
    return errorResponse("Không thể xử lý audio lúc này. Hãy thử nhập tay.", 502);
  }
}
