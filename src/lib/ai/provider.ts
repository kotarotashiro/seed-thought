import type {
  AiProvider,
  ChatMessage,
  ClassifyPostInput,
  GenerateOutputInput,
  GeneratedOutputResult,
  LearningOutput,
  PostClassificationResult,
  PostContext,
  PostSummaryForSearch,
  PostSummaryForTrend,
  SemanticSearchResult,
  SourcePostForLearning,
  StrictLearningOutput,
  TranslateTextInput,
  TrendInsight,
} from "./types";
import {
  buildChatPrompt,
  buildClassifyPrompt,
  buildLearningPrompt,
  buildOutputPrompt,
  buildSemanticSearchPrompt,
  buildStrictLearningPrompt,
  buildTranslatePrompt,
  buildTrendAnalysisPrompt,
} from "./prompts";
import { parseAiJson } from "./json";
import {
  isGeneratedOutputResult,
  isLearningOutput,
  isPostClassificationResult,
  isSemanticSearchResult,
  isStrictLearningOutput,
  isTrendInsight,
  isTranslatedTextResult,
} from "./validation";
import { mergeClassificationFallback } from "./fallback";
import { getAiRuntimeSettings, type AiProviderName, type AiTaskName } from "./settings";
import { mockProvider } from "./mockProvider";
import { getGrokClient } from "./providers/grokProvider";
import { getClaudeClient } from "./providers/claudeProvider";
import { getOpenAIClient } from "./providers/openaiProvider";
import { getGeminiClient } from "./providers/geminiProvider";
import { getKimiClient } from "./providers/kimiProvider";
import type { LLMClient } from "./providers/types";

function buildLLMClient(
  provider: AiProviderName,
  model: string,
  apiKey: string | null
): LLMClient {
  const config = { model, apiKey: apiKey ?? "" };
  switch (provider) {
    case "claude": return getClaudeClient(config);
    case "openai": return getOpenAIClient(config);
    case "gemini": return getGeminiClient(config);
    case "kimi":   return getKimiClient(config);
    default:       return getGrokClient(config);
  }
}

async function getClient(task: AiTaskName): Promise<{
  client: LLMClient;
  isMock: boolean;
  provider: string;
  model: string;
}> {
  const settings = await getAiRuntimeSettings();
  if (settings.tasks[task].provider === "mock") {
    return {
      client: null as unknown as LLMClient,
      isMock: true,
      provider: "mock",
      model: "mock",
    };
  }
  const { provider, model, apiKey } = settings.tasks[task];
  if (!apiKey) {
    throw new Error(
      `[ai/${task}] provider=${provider} の APIキーが見つかりません。設定画面でAPIキーを登録してください。`
    );
  }
  return {
    client: buildLLMClient(provider, model, apiKey),
    isMock: false,
    provider,
    model,
  };
}

// LLM 呼び出し失敗時に provider/model/task を含めた診断ログを出す
function logAiError(task: AiTaskName, provider: string, model: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[ai/${task}] provider=${provider} model=${model} call failed: ${message}`);
}

export function getAiProvider(): AiProvider {
  return {
    async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
      const ctx = await getClient("classifyPost");
      if (ctx.isMock) return mockProvider.classifyPost(input);
      try {
        const prompt = await buildClassifyPrompt(input);
        const result = await ctx.client.chatJson(prompt);
        const classification = parseAiJson(result, isPostClassificationResult, "投稿分類");
        return mergeClassificationFallback(input.text, classification);
      } catch (err) {
        logAiError("classifyPost", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async translateText(input: TranslateTextInput): Promise<string> {
      const ctx = await getClient("translateText");
      if (ctx.isMock) return input.text;
      try {
        const prompt = buildTranslatePrompt(input);
        const result = await ctx.client.chatJson(prompt);
        return parseAiJson(result, isTranslatedTextResult, "日本語翻訳").translatedText;
      } catch (err) {
        logAiError("translateText", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async generateLearningCard(input: SourcePostForLearning): Promise<LearningOutput> {
      const ctx = await getClient("generateLearningCard");
      if (ctx.isMock) return mockProvider.generateLearningCard(input);
      try {
        const prompt = buildLearningPrompt(input);
        const result = await ctx.client.chatJson(prompt);
        return parseAiJson(result, isLearningOutput, "学習カード");
      } catch (err) {
        logAiError("generateLearningCard", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
      const ctx = await getClient("generateOutput");
      if (ctx.isMock) return mockProvider.generateOutput(input);
      try {
        const prompt = await buildOutputPrompt(input);
        const result = await ctx.client.chatJson(prompt);
        return parseAiJson(result, isGeneratedOutputResult, "アウトプット生成");
      } catch (err) {
        logAiError("generateOutput", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async generateStrictLearning(input: {
      postText: string;
      classification: { primaryCategory: string; summary: string };
      articleTitle?: string;
      articleDescription?: string;
      learningCardJson?: string;
      userMemo?: string | null;
    }): Promise<StrictLearningOutput> {
      const ctx = await getClient("generateStrictLearning");
      if (ctx.isMock) return mockProvider.generateStrictLearning(input);
      try {
        const prompt = await buildStrictLearningPrompt(input);
        const result = await ctx.client.chatJson(prompt);
        const wrapper = parseAiJson(result, isGeneratedOutputResult, "厳密学習");
        if (!isStrictLearningOutput(wrapper.contentJson)) {
          throw new Error("厳密学習の形式が不正です");
        }
        return wrapper.contentJson as unknown as StrictLearningOutput;
      } catch (err) {
        logAiError("generateStrictLearning", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async searchSemantically(
      query: string,
      posts: PostSummaryForSearch[]
    ): Promise<SemanticSearchResult> {
      const ctx = await getClient("searchSemantically");
      if (ctx.isMock) return mockProvider.searchSemantically(query, posts);
      try {
        const prompt = buildSemanticSearchPrompt(query, posts);
        const result = await ctx.client.chatJson(prompt);
        return parseAiJson(result, isSemanticSearchResult, "セマンティック検索");
      } catch (err) {
        logAiError("searchSemantically", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async analyzeLikeTrends(posts: PostSummaryForTrend[]): Promise<TrendInsight> {
      const ctx = await getClient("analyzeLikeTrends");
      if (ctx.isMock) return mockProvider.analyzeLikeTrends(posts);
      try {
        const prompt = await buildTrendAnalysisPrompt(posts);
        const result = await ctx.client.chatJson(prompt);
        return parseAiJson(result, isTrendInsight, "傾向分析");
      } catch (err) {
        logAiError("analyzeLikeTrends", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async chat(
      message: string,
      history: ChatMessage[],
      posts: PostContext[]
    ): Promise<string> {
      const ctx = await getClient("chat");
      if (ctx.isMock) return mockProvider.chat(message, history, posts);
      try {
        const prompt = await buildChatPrompt(message, history, posts);
        return await ctx.client.chatText(prompt);
      } catch (err) {
        logAiError("chat", ctx.provider, ctx.model, err);
        throw err;
      }
    },
  };
}
