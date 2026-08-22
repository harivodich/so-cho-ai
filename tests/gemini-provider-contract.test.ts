import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "@/server/ai/providers/gemini";
import { getModelConfig } from "@/server/ai/model-registry";

const previousApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  process.env.GEMINI_API_KEY = previousApiKey;
});

describe("GeminiProvider REST Wire Contract", () => {
  it("formats payload with strict lowerCamelCase REST fields according to Google AI REST specifications", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";

    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body));
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify([{ type: "sale", amount: 100000 }]) }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 50,
          candidatesTokenCount: 20,
          totalTokenCount: 70,
        },
      });
    }) as unknown as typeof fetch;

    const provider = new GeminiProvider();
    const config = getModelConfig("gemini-2.5-flash");

    const result = await provider.generateStructured(
      {
        prompt: "Trích xuất giao dịch bán hàng",
        modelConfig: config,
        systemInstruction: "Bạn là AI trích xuất sổ thu chi.",
        inlineMedia: {
          mimeType: "audio/webm",
          dataBase64: "dGVzdC1ieXRlcw==",
        },
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              amount: { type: "integer" },
            },
          },
        },
      },
      mockFetch,
    );

    expect(capturedUrl).toContain("/models/gemini-2.5-flash:generateContent");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.tokenUsage?.totalTokens).toBe(70);

    // 1. Verify contents array has user role and parts
    const contents = capturedBody.contents as Array<{ role?: string; parts?: Array<Record<string, unknown>> }>;
    expect(contents).toBeDefined();
    expect(contents[0].role).toBe("user");
    expect(contents[0].parts?.[0].text).toBe("Trích xuất giao dịch bán hàng");

    // 2. Verify inlineData (NOT inline_data)
    expect(contents[0].parts?.[1]).toMatchObject({
      inlineData: {
        mimeType: "audio/webm",
        data: "dGVzdC1ieXRlcw==",
      },
    });
    expect((contents[0].parts?.[1] as Record<string, unknown>).inline_data).toBeUndefined();

    // 3. Verify generationConfig lowerCamelCase (responseMimeType, responseSchema, maxOutputTokens)
    const genConfig = capturedBody.generationConfig as Record<string, unknown>;
    expect(genConfig.responseMimeType).toBe("application/json");
    expect(genConfig.response_mime_type).toBeUndefined();
    expect(genConfig.maxOutputTokens).toBe(config.maxTokens);
    expect(genConfig.max_output_tokens).toBeUndefined();
    expect(genConfig.responseSchema).toBeDefined();
    expect(genConfig.response_schema).toBeUndefined();

    // 4. Verify systemInstruction lowerCamelCase (systemInstruction, NOT system_instruction)
    const sysInstruction = capturedBody.systemInstruction as { parts?: Array<{ text?: string }> };
    expect(sysInstruction).toBeDefined();
    expect(sysInstruction.parts?.[0].text).toBe("Bạn là AI trích xuất sổ thu chi.");
    expect(capturedBody.system_instruction).toBeUndefined();
  });
});
