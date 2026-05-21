import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
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
  TranslateTextInput,
  TrendInsight,
} from "./types";
import {
  buildChatPrompt,
  buildClassifyPrompt,
  buildLearningPrompt,
  buildOutputPrompt,
  buildSemanticSearchPrompt,
  buildTranslatePrompt,
  buildTrendAnalysisPrompt,
} from "./prompts";
import { parseAiJson } from "./json";
import {
  isGeneratedOutputResult,
  isLearningOutput,
  isPostClassificationResult,
  isSemanticSearchResult,
  isTrendInsight,
  isTranslatedTextResult,
} from "./validation";
import { mergeClassificationFallback } from "./fallback";
import { getAiRuntimeSettings, type AiProviderName, type AiRuntimeSettings } from "./settings";
import { mockProvider } from "./mockProvider";

async function callGemini(prompt: string, settings: AiRuntimeSettings): Promise<string> {
  if (!settings.apiKey) throw new Error("GEMINI_API_KEY is not set");
  const client = new GoogleGenAI({ apiKey: settings.apiKey });
  const response = await client.models.generateContent({
    model: settings.model,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return response.text || "{}";
}

async function callGeminiText(prompt: string, settings: AiRuntimeSettings): Promise<string> {
  if (!settings.apiKey) throw new Error("GEMINI_API_KEY is not set");
  const client = new GoogleGenAI({ apiKey: settings.apiKey });
  const response = await client.models.generateContent({
    model: settings.model,
    contents: prompt,
  });
  return response.text || "";
}

function getOpenAiBaseUrl(provider: AiProviderName): string | undefined {
  if (provider === "grok") return "https://api.x.ai/v1";
  if (provider === "kimi") return "https://api.moonshot.ai/v1";
  return undefined;
}

async function callOpenAiCompatible(prompt: string, settings: AiRuntimeSettings): Promise<string> {
  if (!settings.apiKey) {
    if (settings.provider === "openai") throw new Error("OPENAI_API_KEY is not set");
    if (settings.provider === "grok") throw new Error("GROK_API_KEY is not set");
    if (settings.provider === "kimi") throw new Error("KIMI_API_KEY is not set");
    throw new Error("AI API key is not set");
  }

  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: getOpenAiBaseUrl(settings.provider),
  });

  const response = await client.chat.completions.create({
    model: settings.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  return response.choices[0]?.message?.content || "{}";
}

async function callOpenAiCompatibleText(prompt: string, settings: AiRuntimeSettings): Promise<string> {
  if (!settings.apiKey) throw new Error("AI API key is not set");

  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: getOpenAiBaseUrl(settings.provider),
  });

  const response = await client.chat.completions.create({
    model: settings.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "";
}

async function callClaude(prompt: string, settings: AiRuntimeSettings): Promise<string> {
  if (!settings.apiKey) throw new Error("CLAUDE_API_KEY is not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 4096,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const textBlocks = Array.isArray(data.content)
    ? data.content
        .filter((block: { type?: string; text?: string }) => block.type === "text")
        .map((block: { text?: string }) => block.text || "")
    : [];
  return textBlocks.join("\n").trim() || "{}";
}

async function callConfiguredAi(prompt: string): Promise<string> {
  const settings = await getAiRuntimeSettings();

  switch (settings.provider) {
    case "gemini":
      return callGemini(prompt, settings);
    case "openai":
    case "grok":
    case "kimi":
      return callOpenAiCompatible(prompt, settings);
    case "claude":
      return callClaude(prompt, settings);
    case "mock":
    default:
      throw new Error("mock provider does not support direct calls");
  }
}

async function callConfiguredAiText(prompt: string): Promise<string> {
  const settings = await getAiRuntimeSettings();

  switch (settings.provider) {
    case "gemini":
      return callGeminiText(prompt, settings);
    case "openai":
    case "grok":
    case "kimi":
      return callOpenAiCompatibleText(prompt, settings);
    case "claude":
      return callClaude(prompt, settings);
    case "mock":
    default:
      return "（モックプロバイダーはチャット非対応です）";
  }
}

export function getAiProvider(): AiProvider {
  return {
    async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return mockProvider.classifyPost(input);

      const prompt = await buildClassifyPrompt(input);
      const result = await callConfiguredAi(prompt);
      const classification = parseAiJson(result, isPostClassificationResult, "投稿分類");
      return mergeClassificationFallback(input.text, classification);
    },

    async translateText(input: TranslateTextInput): Promise<string> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return input.text;

      const prompt = buildTranslatePrompt(input);
      const result = await callConfiguredAi(prompt);
      return parseAiJson(result, isTranslatedTextResult, "日本語翻訳").translatedText;
    },

    async generateLearningCard(input: SourcePostForLearning): Promise<LearningOutput> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return mockProvider.generateLearningCard(input);

      const prompt = buildLearningPrompt(input);
      const result = await callConfiguredAi(prompt);
      return parseAiJson(result, isLearningOutput, "学習カード");
    },

    async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
      const settings = await getAiRuntimeSettings();
      if (settings.provider === "mock") return mockProvider.generateOutput(input);

      const prompt = await buildOutputPrompt(input);
      const result = await callConfiguredAi(prompt);
      return parseAiJson(result, isGeneratedOutputResult, "アウトプット生成");
    },

    async searchSemantically(query: string, posts: PostSummaryForSearch[]): Promise<SemanticSearchResult> {
      const prompt = buildSemanticSearchPrompt(query, posts);
      const result = await callConfiguredAi(prompt);
      return parseAiJson(result, isSemanticSearchResult, "セマンティック検索");
    },

    async analyzeLikeTrends(posts: PostSummaryForTrend[]): Promise<TrendInsight> {
      const prompt = await buildTrendAnalysisPrompt(posts);
      const result = await callConfiguredAi(prompt);
      return parseAiJson(result, isTrendInsight, "傾向分析");
    },

    async chat(message: string, history: ChatMessage[], posts: PostContext[]): Promise<string> {
      const prompt = await buildChatPrompt(message, history, posts);
      return callConfiguredAiText(prompt);
    },
  };
}
