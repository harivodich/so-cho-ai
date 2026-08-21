import { AppHttpError } from "@/server/http/errors";
import type { AiProvider, GenerateStructuredParams, GenerateStructuredResult } from "@/server/ai/provider";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiCandidateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GeminiProvider implements AiProvider {
  public readonly name = "gemini";

  private getApiKey(): string {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new AppHttpError(503, "SERVICE_UNCONFIGURED", "Gemini API key chưa được cấu hình trên server.");
    }
    return key;
  }

  async generateStructured(
    params: GenerateStructuredParams,
    fetchImpl: typeof fetch = fetch,
  ): Promise<GenerateStructuredResult> {
    const apiKey = this.getApiKey();
    const startTime = Date.now();
    const model = params.modelConfig.modelName;

    const parts: Array<Record<string, unknown>> = [{ text: params.prompt }];
    if (params.inlineMedia) {
      parts.push({
        inline_data: {
          mime_type: params.inlineMedia.mimeType,
          data: params.inlineMedia.dataBase64,
        },
      });
    }

    const payload: Record<string, unknown> = {
      contents: [{ parts }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: params.modelConfig.temperature,
        ...(params.responseSchema ? { response_schema: params.responseSchema } : {}),
      },
    };

    if (params.systemInstruction) {
      payload.system_instruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    let response: Response;
    try {
      response = await fetchImpl(
        `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: AbortSignal.timeout(params.modelConfig.timeoutMs),
          body: JSON.stringify(payload),
        },
      );
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AppHttpError(504 as any, "AI_PROVIDER_ERROR", `Gemini phản hồi quá thời gian quy định (${params.modelConfig.timeoutMs}ms).`);
      }
      throw new AppHttpError(502, "AI_PROVIDER_ERROR", "Không thể kết nối đến Gemini provider lúc này.");
    }

    const latencyMs = Date.now() - startTime;

    if (response.status === 429) {
      throw new AppHttpError(429, "QUOTA_EXCEEDED", "Gemini đã đạt giới hạn tạm thời (Rate Limited). Hãy thử lại sau giây lát.");
    }

    if (!response.ok) {
      throw new AppHttpError(502, "AI_PROVIDER_ERROR", `Gemini trả lỗi HTTP ${response.status}.`);
    }

    let body: GeminiCandidateResponse;
    try {
      body = (await response.json()) as GeminiCandidateResponse;
    } catch {
      throw new AppHttpError(502, "AI_PROVIDER_ERROR", "Gemini trả dữ liệu JSON không hợp lệ.");
    }

    const rawText = body.candidates
      ?.flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text)
      .filter((t): t is string => typeof t === "string")
      .join("")
      .trim();

    if (!rawText) {
      throw new AppHttpError(502, "AI_PROVIDER_ERROR", "Gemini không trả về nội dung.");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new AppHttpError(422, "UNPROCESSABLE_ENTITY", "Không thể phân giải JSON từ phản hồi của Gemini.");
    }

    return {
      rawText,
      parsedJson,
      latencyMs,
      tokenUsage: {
        promptTokens: body.usageMetadata?.promptTokenCount,
        completionTokens: body.usageMetadata?.candidatesTokenCount,
        totalTokens: body.usageMetadata?.totalTokenCount,
      },
    };
  }
}

export const defaultGeminiProvider = new GeminiProvider();
