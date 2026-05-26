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
import { getAiRuntimeSettings } from "./settings";
import { mockProvider } from "./mockProvider";
import { xaiChat } from "@/lib/xai/client";

async function callGrok(prompt: string): Promise<string> {
  const result = await xaiChat({
    messages: [{ role: "user", content: prompt }],
    jsonMode: true,
    temperature: 0.4,
  });
  return result.content || "{}";
}

async function callGrokText(prompt: string): Promise<string> {
  const result = await xaiChat({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });
  return result.content || "";
}

export function getAiProvider(): AiProvider {
  return {
    async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return mockProvider.classifyPost(input);

      const prompt = await buildClassifyPrompt(input);
      const result = await callGrok(prompt);
      const classification = parseAiJson(result, isPostClassificationResult, "投稿分類");
      return mergeClassificationFallback(input.text, classification);
    },

    async translateText(input: TranslateTextInput): Promise<string> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return input.text;

      const prompt = buildTranslatePrompt(input);
      const result = await callGrok(prompt);
      return parseAiJson(result, isTranslatedTextResult, "日本語翻訳").translatedText;
    },

    async generateLearningCard(input: SourcePostForLearning): Promise<LearningOutput> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return mockProvider.generateLearningCard(input);

      const prompt = buildLearningPrompt(input);
      const result = await callGrok(prompt);
      return parseAiJson(result, isLearningOutput, "学習カード");
    },

    async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return mockProvider.generateOutput(input);

      const prompt = await buildOutputPrompt(input);
      const result = await callGrok(prompt);
      return parseAiJson(result, isGeneratedOutputResult, "アウトプット生成");
    },

    async generateStrictLearning(input: {
      postText: string;
      classification: { primaryCategory: string; summary: string };
      learningCardJson?: string;
      userMemo?: string | null;
    }): Promise<StrictLearningOutput> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return mockProvider.generateStrictLearning(input);

      const prompt = await buildStrictLearningPrompt({
        postText: input.postText,
        classification: input.classification,
        learningCardJson: input.learningCardJson,
        userMemo: input.userMemo,
      });
      const result = await callGrok(prompt);
      const wrapper = parseAiJson(result, isGeneratedOutputResult, "厳密学習");
      if (!isStrictLearningOutput(wrapper.contentJson)) {
        throw new Error("厳密学習の形式が不正です");
      }
      return wrapper.contentJson as unknown as StrictLearningOutput;
    },

    async searchSemantically(query: string, posts: PostSummaryForSearch[]): Promise<SemanticSearchResult> {
      const prompt = buildSemanticSearchPrompt(query, posts);
      const result = await callGrok(prompt);
      return parseAiJson(result, isSemanticSearchResult, "セマンティック検索");
    },

    async analyzeLikeTrends(posts: PostSummaryForTrend[]): Promise<TrendInsight> {
      const prompt = await buildTrendAnalysisPrompt(posts);
      const result = await callGrok(prompt);
      return parseAiJson(result, isTrendInsight, "傾向分析");
    },

    async chat(message: string, history: ChatMessage[], posts: PostContext[]): Promise<string> {
      const prompt = await buildChatPrompt(message, history, posts);
      return callGrokText(prompt);
    },
  };
}
