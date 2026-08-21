import type { AiModelConfig } from "@/types/ai";

export const DEFAULT_MODEL_ID = "gemini-2.5-flash";

export const MODEL_REGISTRY: Record<string, AiModelConfig> = {
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    provider: "gemini",
    modelName: "gemini-2.5-flash",
    maxTokens: 4096,
    temperature: 0.1,
    timeoutMs: 25_000,
    supportsVision: true,
    supportsAudio: true,
  },
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    provider: "gemini",
    modelName: "gemini-2.0-flash",
    maxTokens: 4096,
    temperature: 0.1,
    timeoutMs: 20_000,
    supportsVision: true,
    supportsAudio: true,
  },
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    provider: "gemini",
    modelName: "gemini-2.5-pro",
    maxTokens: 8192,
    temperature: 0.2,
    timeoutMs: 40_000,
    supportsVision: true,
    supportsAudio: true,
  },
};

export function getModelConfig(modelId?: string): AiModelConfig {
  const selected = modelId ? MODEL_REGISTRY[modelId] : undefined;
  if (selected) return selected;
  return MODEL_REGISTRY[DEFAULT_MODEL_ID];
}
