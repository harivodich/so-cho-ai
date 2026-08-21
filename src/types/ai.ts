export type AiTaskMode = "voice" | "image" | "insight";

export type ExtractionRun = {
  runId: string;
  mode: "voice" | "image";
  model: string;
  promptVersion: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  draftCount: number;
  qualityCheckCount: number;
  needsReview: boolean;
};

export type DraftCorrectionEvent = {
  runId: string;
  mode: "voice" | "image";
  field: "type" | "amount" | "item" | "quantity" | "unit" | "note";
  wasModified: boolean;
  originalEmpty: boolean;
};

export type PromptDefinition<TInput = unknown, TOutput = unknown> = {
  id: string;
  version: string;
  description: string;
  owner: string;
  createdAt: string;
  changelog: string;
  systemInstruction?: string;
  buildPrompt: (input: TInput) => string;
  validateOutput?: (raw: unknown) => TOutput;
};

export type AiModelConfig = {
  id: string;
  provider: "gemini" | "openai" | "custom";
  modelName: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  supportsVision: boolean;
  supportsAudio: boolean;
};
