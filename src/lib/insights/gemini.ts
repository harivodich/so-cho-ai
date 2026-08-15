import {
  dailyInsightJsonSchema,
  dailyInsightSchema,
  type DailyInsight,
  type DailyInsightSnapshot,
} from "@/lib/insights/schema";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 20_000;

export class DailyInsightError extends Error {
  constructor(readonly kind: "configuration" | "quota" | "unavailable" | "invalid-response", message: string) {
    super(message);
    this.name = "DailyInsightError";
  }
}

type GenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
  }>;
};

const instruction = `Bạn viết nhận xét cuối ngày cho một sổ thu chi bán lẻ nhỏ ở Việt Nam.

Chỉ diễn giải các số liệu JSON đã cung cấp. Không tự tính lại, không thêm số, không dự báo, không khuyên tăng giá, giảm giá, nhập hàng hay chạy khuyến mãi. Không gọi doanh thu là lợi nhuận.

Nếu estimatedGrossProfit là null hoặc missingCostSaleCount lớn hơn 0, phải nói rõ chưa đủ dữ liệu giá vốn và không nhận xét lãi. Nếu có sevenDay, chỉ được so sánh doanh thu hôm nay với averageDailyRevenue và phải dùng đúng các số đã cho; nếu averageDailyRevenue là 0 thì nói chưa đủ dữ liệu so sánh. Không dự báo hoặc khuyên tăng giá, giảm giá hay nhập hàng. Dùng tiếng Việt dễ hiểu, ngắn gọn, không phán xét.`;

function responseText(response: GenerateContentResponse): string | null {
  const text = response.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter((item): item is string => typeof item === "string")
    .join("")
    .trim();

  return text || null;
}

export async function generateDailyInsight(
  snapshot: DailyInsightSnapshot,
  fetchImpl: typeof fetch = fetch,
): Promise<DailyInsight> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new DailyInsightError("configuration", "Gemini chưa được cấu hình trên server.");

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const response = await fetchImpl(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      system_instruction: { parts: [{ text: instruction }] },
      contents: [{ parts: [{ text: `Dữ liệu tổng hợp do ứng dụng tính bằng code:\n${JSON.stringify(snapshot)}` }] }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: dailyInsightJsonSchema,
      },
    }),
  });

  if (response.status === 429) throw new DailyInsightError("quota", "Gemini đã đạt giới hạn tạm thời. Hãy thử lại sau.");
  if (!response.ok) throw new DailyInsightError("unavailable", "Gemini chưa thể tạo nhận xét lúc này.");

  let body: GenerateContentResponse;
  try {
    body = (await response.json()) as GenerateContentResponse;
  } catch {
    throw new DailyInsightError("invalid-response", "Gemini trả phản hồi không đọc được.");
  }

  const outputText = responseText(body);
  if (!outputText) throw new DailyInsightError("invalid-response", "Gemini không trả nội dung nhận xét.");

  try {
    return dailyInsightSchema.parse(JSON.parse(outputText));
  } catch {
    throw new DailyInsightError("invalid-response", "Gemini trả nhận xét không đúng cấu trúc.");
  }
}
