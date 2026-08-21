import type { AiModelConfig } from "@/types/ai";

export type GenerateStructuredParams = {
  modelConfig: AiModelConfig;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>;
  inlineMedia?: {
    mimeType: string;
    dataBase64: string;
  };
};

export type GenerateStructuredResult = {
  rawText: string;
  parsedJson: unknown;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export interface AiProvider {
  readonly name: string;
  generateStructured(params: GenerateStructuredParams): Promise<GenerateStructuredResult>;
}
