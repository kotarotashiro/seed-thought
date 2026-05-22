import { GoogleGenAI } from "@google/genai";
import type {
  AiProvider,
  ChatMessage,
  ClassifyPostInput,
  PostClassificationResult,
  GenerateOutputInput,
  GeneratedOutputResult,
  LearningOutput,
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

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

async function callGemini(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.models.generateContent({
    model: getModel(),
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });
  return response.text || "{}";
}

async function callGeminiText(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.models.generateContent({
    model: getModel(),
    contents: prompt,
  });
  return response.text || "";
}

export const geminiProvider: AiProvider = {
  async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
    const prompt = await buildClassifyPrompt(input);
    const result = await callGemini(prompt);
    const classification = parseAiJson(result, isPostClassificationResult, "投稿分類");
    return mergeClassificationFallback(input.text, classification);
  },

  async translateText(input: TranslateTextInput): Promise<string> {
    const prompt = buildTranslatePrompt(input);
    const result = await callGemini(prompt);
    return parseAiJson(result, isTranslatedTextResult, "日本語翻訳").translatedText;
  },

  async generateLearningCard(input: SourcePostForLearning): Promise<LearningOutput> {
    const prompt = buildLearningPrompt(input);
    const result = await callGemini(prompt);
    return parseAiJson(result, isLearningOutput, "学習カード");
  },

  async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
    const prompt = await buildOutputPrompt(input);
    const result = await callGemini(prompt);
    return parseAiJson(result, isGeneratedOutputResult, "アウトプット生成");
  },

  async generateStrictLearning(input: {
    postText: string;
    classification: { primaryCategory: string; summary: string };
    learningCardJson?: string;
    userMemo?: string | null;
  }): Promise<StrictLearningOutput> {
    const prompt = await buildStrictLearningPrompt({
      postText: input.postText,
      classification: input.classification,
      learningCardJson: input.learningCardJson,
      userMemo: input.userMemo,
    });
    const result = await callGemini(prompt);
    const wrapper = parseAiJson(result, isGeneratedOutputResult, "厳密学習");
    if (!isStrictLearningOutput(wrapper.contentJson)) {
      throw new Error("厳密学習の形式が不正です");
    }
    return wrapper.contentJson as unknown as StrictLearningOutput;
  },

  async searchSemantically(query: string, posts: PostSummaryForSearch[]): Promise<SemanticSearchResult> {
    const prompt = buildSemanticSearchPrompt(query, posts);
    const result = await callGemini(prompt);
    return parseAiJson(result, isSemanticSearchResult, "セマンティック検索");
  },

  async analyzeLikeTrends(posts: PostSummaryForTrend[]): Promise<TrendInsight> {
    const prompt = await buildTrendAnalysisPrompt(posts);
    const result = await callGemini(prompt);
    return parseAiJson(result, isTrendInsight, "傾向分析");
  },

  async chat(message: string, history: ChatMessage[], posts: PostContext[]): Promise<string> {
    const prompt = await buildChatPrompt(message, history, posts);
    return callGeminiText(prompt);
  },
};
