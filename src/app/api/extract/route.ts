import { NextResponse } from "next/server";

import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";
import { extractTransactionFromAudio, extractTransactionsFromImage, GeminiRequestError } from "@/lib/extraction/gemini";
import { ExtractionQuotaError, enforceExtractionQuota, vietnamDateKey } from "@/lib/extraction/quota";
import { applyDataQualityGuard } from "@/lib/extraction/data-quality";
import { ExtractionValidationError } from "@/lib/extraction/schema";
import { validateAudioUpload } from "@/lib/extraction/audio-validation";
import { validateImageUpload } from "@/lib/extraction/image-validation";

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
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
    if (decoded.firebase?.sign_in_provider === "anonymous") {
      return errorResponse("Hãy đăng nhập tài khoản thật trước khi dùng trích xuất AI.", 403);
    }
    return decoded.uid;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.startsWith("auth/")) {
      return errorResponse("Phiên đăng nhập không hợp lệ. Hãy tải lại trang.", 401);
    }
    return errorResponse("Không thể xác thực tài khoản trên server lúc này.", 503);
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 6 * 1024 * 1024) {
    return errorResponse("Tệp tải lên vượt giới hạn cho phép.", 413);
  }
  const userId = await authenticatedUserId(request);
  if (userId instanceof NextResponse) return userId;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Yêu cầu audio không hợp lệ.", 400);
  }

  const mode = formData.get("mode");
  if (mode !== "voice" && mode !== "image") {
    return errorResponse("Mode trích xuất không hợp lệ.", 400);
  }

  const file = formData.get(mode === "voice" ? "audio" : "image");
  if (!(file instanceof File)) {
    return errorResponse(mode === "voice" ? "Chưa nhận được file audio." : "Chưa nhận được file ảnh.", 400);
  }
  const fileValidation = mode === "voice"
    ? validateAudioUpload(file.size, file.type)
    : validateImageUpload(file.size, file.type);
  if (!fileValidation.valid) {
    return errorResponse(fileValidation.message, fileValidation.status);
  }

  try {
    await enforceExtractionQuota(userId);
    const fileBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const currentDate = vietnamDateKey(new Date());
    const extraction = mode === "voice"
      ? extractTransactionFromAudio({ audioBase64: fileBase64, mimeType: file.type, currentDate })
      : extractTransactionsFromImage({ imageBase64: fileBase64, mimeType: file.type, currentDate });
    const [drafts, history] = await Promise.all([
      extraction,
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
    return errorResponse(mode === "voice" ? "Không thể xử lý audio lúc này. Hãy thử nhập tay." : "Không thể đọc ảnh hóa đơn lúc này. Hãy chụp lại ảnh rõ hơn hoặc nhập tay.", 502);
  }
}
