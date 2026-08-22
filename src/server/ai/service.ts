import { randomUUID } from "node:crypto";

import { transactionDraftsJsonSchema, imageTransactionDraftsJsonSchema, parseExtractionDrafts, parseImageExtractionDrafts } from "@/lib/extraction/schema";
import { applyDataQualityGuard } from "@/lib/extraction/data-quality";
import { dailyInsightJsonSchema, dailyInsightSchema, type DailyInsight, type DailyInsightSnapshot } from "@/lib/insights/schema";
import { promptRegistry } from "@/server/ai/prompt-registry";
import { getModelConfig } from "@/server/ai/model-registry";
import { defaultGeminiProvider, type GeminiProvider } from "@/server/ai/providers/gemini";
import { metrics } from "@/server/observability/metrics";
import { logger } from "@/server/observability/logger";
import { AppHttpError } from "@/server/http/errors";
import type { ExtractionRun } from "@/types/ai";
import type { TransactionDraft } from "@/types/transaction";

export type TransactionHistorySample = {
  amount: number;
  type: "sale" | "purchase" | "expense";
  canonicalItemName: string | null;
};

export type AudioExtractionServiceInput = {
  audioBase64: string;
  mimeType: string;
  currentDate: string;
  history?: TransactionHistorySample[];
  modelId?: string;
  promptVersion?: string;
  fetchImpl?: typeof fetch;
};

export type ImageExtractionServiceInput = {
  imageBase64: string;
  mimeType: string;
  currentDate: string;
  history?: TransactionHistorySample[];
  modelId?: string;
  promptVersion?: string;
  fetchImpl?: typeof fetch;
};

export type DailyInsightServiceInput = {
  snapshot: DailyInsightSnapshot;
  modelId?: string;
  promptVersion?: string;
  fetchImpl?: typeof fetch;
};

export class AiApplicationService {
  constructor(private readonly provider: GeminiProvider = defaultGeminiProvider) {}

  async extractAudio(input: AudioExtractionServiceInput): Promise<{
    drafts: TransactionDraft[];
    run: ExtractionRun;
  }> {
    const promptVersion = input.promptVersion || "text-extraction-v2";
    const promptDef = promptRegistry.getOrThrow<{ currentDate: string }>(promptVersion);
    const modelConfig = getModelConfig(input.modelId || process.env.GEMINI_MODEL);

    const promptText = promptDef.buildPrompt({ currentDate: input.currentDate });

    let result;
    try {
      result = await this.provider.generateStructured(
        {
          modelConfig,
          prompt: promptText,
          responseSchema: transactionDraftsJsonSchema as unknown as Record<string, unknown>,
          inlineMedia: {
            mimeType: input.mimeType,
            dataBase64: input.audioBase64,
          },
        },
        input.fetchImpl,
      );
    } catch (err) {
      metrics.recordAiCall(modelConfig.modelName, 0, false);
      logger.error("AI audio extraction provider failed", { model: modelConfig.modelName, promptVersion, error: String(err) });
      throw err;
    }

    try {
      const rawDrafts = parseExtractionDrafts(result.parsedJson, input.currentDate);
      const history = input.history || [];
      const drafts = rawDrafts.map((draft) =>
        applyDataQualityGuard(draft, { currentDate: input.currentDate, history }),
      );

      // Record metric ONLY after complete verification and guard checks
      metrics.recordAiCall(modelConfig.modelName, result.latencyMs, true, result.tokenUsage);

      const run: ExtractionRun = {
        runId: randomUUID(),
        mode: "voice",
        model: modelConfig.modelName,
        promptVersion,
        latencyMs: result.latencyMs,
        tokenUsage: result.tokenUsage,
        draftCount: drafts.length,
        qualityCheckCount: drafts.reduce((acc, d) => acc + (d.qualityChecks?.length || 0), 0),
        needsReview: drafts.some((d) => (d.qualityChecks && d.qualityChecks.length > 0) || d.missingFields.length > 0),
      };

      return { drafts, run };
    } catch (err) {
      metrics.recordAiCall(modelConfig.modelName, result.latencyMs, false);
      logger.error("AI audio extraction schema validation failed", { model: modelConfig.modelName, promptVersion, error: String(err) });
      throw err;
    }
  }

  async extractImage(input: ImageExtractionServiceInput): Promise<{
    drafts: TransactionDraft[];
    run: ExtractionRun;
  }> {
    const promptVersion = input.promptVersion || "image-extraction-v1";
    const promptDef = promptRegistry.getOrThrow<{ currentDate: string }>(promptVersion);
    const modelConfig = getModelConfig(input.modelId || process.env.GEMINI_MODEL);

    const promptText = promptDef.buildPrompt({ currentDate: input.currentDate });

    let result;
    try {
      result = await this.provider.generateStructured(
        {
          modelConfig,
          prompt: promptText,
          responseSchema: imageTransactionDraftsJsonSchema as unknown as Record<string, unknown>,
          inlineMedia: {
            mimeType: input.mimeType,
            dataBase64: input.imageBase64,
          },
        },
        input.fetchImpl,
      );
    } catch (err) {
      metrics.recordAiCall(modelConfig.modelName, 0, false);
      logger.error("AI image extraction provider failed", { model: modelConfig.modelName, promptVersion, error: String(err) });
      throw err;
    }

    try {
      const rawDrafts = parseImageExtractionDrafts(result.parsedJson, input.currentDate);
      const history = input.history || [];
      const drafts = rawDrafts.map((draft) =>
        applyDataQualityGuard(draft, { currentDate: input.currentDate, history }),
      );

      // Record metric ONLY after complete verification and guard checks
      metrics.recordAiCall(modelConfig.modelName, result.latencyMs, true, result.tokenUsage);

      const run: ExtractionRun = {
        runId: randomUUID(),
        mode: "image",
        model: modelConfig.modelName,
        promptVersion,
        latencyMs: result.latencyMs,
        tokenUsage: result.tokenUsage,
        draftCount: drafts.length,
        qualityCheckCount: drafts.reduce((acc, d) => acc + (d.qualityChecks?.length || 0), 0),
        needsReview: drafts.some((d) => (d.qualityChecks && d.qualityChecks.length > 0) || d.missingFields.length > 0),
      };

      return { drafts, run };
    } catch (err) {
      metrics.recordAiCall(modelConfig.modelName, result.latencyMs, false);
      logger.error("AI image extraction schema validation failed", { model: modelConfig.modelName, promptVersion, error: String(err) });
      throw err;
    }
  }

  async generateDailyInsight(input: DailyInsightServiceInput): Promise<{
    insight: DailyInsight;
    latencyMs: number;
  }> {
    const promptVersion = input.promptVersion || "daily-insight-v1";
    const promptDef = promptRegistry.getOrThrow<DailyInsightSnapshot>(promptVersion);
    const modelConfig = getModelConfig(input.modelId || process.env.GEMINI_MODEL);

    const promptText = promptDef.buildPrompt(input.snapshot);

    let result;
    try {
      result = await this.provider.generateStructured(
        {
          modelConfig,
          prompt: promptText,
          systemInstruction: promptDef.systemInstruction,
          responseSchema: dailyInsightJsonSchema as unknown as Record<string, unknown>,
        },
        input.fetchImpl,
      );
    } catch (err) {
      metrics.recordAiCall(modelConfig.modelName, 0, false);
      logger.error("AI daily insight provider failed", { model: modelConfig.modelName, promptVersion, error: String(err) });
      throw err;
    }

    const parsed = dailyInsightSchema.safeParse(result.parsedJson);
    if (!parsed.success) {
      metrics.recordAiCall(modelConfig.modelName, result.latencyMs, false);
      logger.error("AI daily insight output schema mismatch", { model: modelConfig.modelName, promptVersion });
      throw new AppHttpError(422, "UNPROCESSABLE_ENTITY", "Không thể phân tích cấu trúc phản hồi nhận xét AI.");
    }

    metrics.recordAiCall(modelConfig.modelName, result.latencyMs, true, result.tokenUsage);

    return {
      insight: parsed.data,
      latencyMs: result.latencyMs,
    };
  }
}

export const aiApplicationService = new AiApplicationService();
