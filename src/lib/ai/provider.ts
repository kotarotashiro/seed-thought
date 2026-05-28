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

async function getClient(task: AiTaskName): Promise<{ client: LLMClient; isMock: boolean }> {
  const settings = await getAiRuntimeSettings();
  if (settings.tasks[task].provider === "mock") {
    return { client: null as unknown as LLMClient, isMock: true };
  }
  const { provider, model, apiKey } = settings.tasks[task];
  return { client: buildLLMClient(provider, model, apiKey), isMock: false };
}

export function getAiProvider(): AiProvider {
  return {
    async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
      const { client, isMock } = await getClient("classifyPost");
      if (isMock) return mockProvider.classifyPost(input);
      const prompt = await buildClassifyPrompt(input);
      const result = await client.chatJson(prompt);
      const classification = parseAiJson(result, isPostClassificationResult, "投稿分類");
      return mergeClassificationFallback(input.text, classification);
    },

    async translateText(input: TranslateTextInput): Promise<string> {
      const { client, isMock } = await getClient("translateText");
      if (isMock) return input.text;
      const prompt = buildTranslatePrompt(input);
      const result = await client.chatJson(prompt);
      return parseAiJson(result, isTranslatedTextResult, "日本語翻訳").translatedText;
    },

    async generateLearningCard(input: SourcePostForLearning): Promise<LearningOutput> {
      const { client, isMock } = await getClient("generateLearningCard");
      if (isMock) return mockProvider.generateLearningCard(input);
      const prompt = buildLearningPrompt(input);
      const result = await client.chatJson(prompt);
      return parseAiJson(result, isLearningOutput, "学習カード");
    },

    async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
      const { client, isMock } = await getClient("generateOutput");
      if (isMock) return mockProvider.generateOutput(input);
      const prompt = await buildOutputPrompt(input);
      const result = await client.chatJson(prompt);
      return parseAiJson(result, isGeneratedOutputResult, "アウトプット生成");
    },

    async generateStrictLearning(input: {
      postText: string;
      classification: { primaryCategory: string; summary: string };
      articleTitle?: string;
      articleDescription?: string;
      learningCardJson?: string;
      userMemo?: string | null;
    }): Promise<StrictLearningOutput> {
      const { client, isMock } = await getClient("generateStrictLearning");
      if (isMock) return mockProvider.generateStrictLearning(input);
      const prompt = await buildStrictLearningPrompt(input);
      const result = await client.chatJson(prompt);
      const wrapper = parseAiJson(result, isGeneratedOutputResult, "厳密学習");
      if (!isStrictLearningOutput(wrapper.contentJson)) {
        throw new Error("厳密学習の形式が不正です");
      }
      return wrapper.contentJson as unknown as StrictLearningOutput;
    },

    async searchSemantically(
      query: string,
      posts: PostSummaryForSearch[]
    ): Promise<SemanticSearchResult> {
      const { client, isMock } = await getClient("searchSemantically");
      if (isMock) return mockProvider.searchSemantically(query, posts);
      const prompt = buildSemanticSearchPrompt(query, posts);
      const result = await client.chatJson(prompt);
      return parseAiJson(result, isSemanticSearchResult, "セマンティック検索");
    },

    async analyzeLikeTrends(posts: PostSummaryForTrend[]): Promise<TrendInsight> {
      const { client, isMock } = await getClient("analyzeLikeTrends");
      if (isMock) return mockProvider.analyzeLikeTrends(posts);
      const prompt = await buildTrendAnalysisPrompt(posts);
      const result = await client.chatJson(prompt);
      return parseAiJson(result, isTrendInsight, "傾向分析");
    },

    async chat(
      message: string,
      history: ChatMessage[],
      posts: PostContext[]
    ): Promise<string> {
      const { client, isMock } = await getClient("chat");
      if (isMock) return mockProvider.chat(message, history, posts);
      const prompt = await buildChatPrompt(message, history, posts);
      return client.chatText(prompt);
    },
  };
}
