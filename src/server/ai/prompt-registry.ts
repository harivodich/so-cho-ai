import { textExtractionPromptV2 } from "@/server/ai/prompts/text-extraction-v2";
import { imageExtractionPromptV1 } from "@/server/ai/prompts/image-extraction-v1";
import { dailyInsightPromptV1 } from "@/server/ai/prompts/daily-insight-v1";
import type { PromptDefinition } from "@/types/ai";

const registry = new Map<string, PromptDefinition<any, any>>();

// Register default prompt versions
registry.set(textExtractionPromptV2.version, textExtractionPromptV2);
registry.set(textExtractionPromptV2.id, textExtractionPromptV2); // default for id

registry.set(imageExtractionPromptV1.version, imageExtractionPromptV1);
registry.set(imageExtractionPromptV1.id, imageExtractionPromptV1); // default for id

registry.set(dailyInsightPromptV1.version, dailyInsightPromptV1);
registry.set(dailyInsightPromptV1.id, dailyInsightPromptV1); // default for id

export const promptRegistry = {
  get<TInput = unknown, TOutput = unknown>(
    idOrVersion: string,
  ): PromptDefinition<TInput, TOutput> | undefined {
    return registry.get(idOrVersion) as PromptDefinition<TInput, TOutput> | undefined;
  },

  getOrThrow<TInput = unknown, TOutput = unknown>(
    idOrVersion: string,
  ): PromptDefinition<TInput, TOutput> {
    const prompt = registry.get(idOrVersion);
    if (!prompt) {
      throw new Error(`Prompt '${idOrVersion}' is not registered in the prompt registry.`);
    }
    return prompt as PromptDefinition<TInput, TOutput>;
  },

  listAll(): Array<{ id: string; version: string; description: string; owner: string }> {
    const seen = new Set<string>();
    const list: Array<{ id: string; version: string; description: string; owner: string }> = [];
    for (const prompt of registry.values()) {
      if (!seen.has(prompt.version)) {
        seen.add(prompt.version);
        list.push({
          id: prompt.id,
          version: prompt.version,
          description: prompt.description,
          owner: prompt.owner,
        });
      }
    }
    return list;
  },
};
