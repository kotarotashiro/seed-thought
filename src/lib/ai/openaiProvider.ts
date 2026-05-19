import OpenAI from "openai";
import type {
  AiProvider,
  ChatMessage,
  ClassifyPostInput,
  PostClassificationResult,
  GenerateDeepDiveSessionInput,
  GeneratedDeepDiveSessionResult,
  GenerateOutputInput,
  GeneratedOutputResult,
  PostContext,
  PostSummaryForSearch,
  PostSummaryForTrend,
  SemanticSearchResult,
  TranslateTextInput,
  TrendInsight,
} from "./types";
import { buildChatPrompt, buildClassifyPrompt, buildDeepDivePrompt, buildOutputPrompt, buildSemanticSearchPrompt, buildTranslatePrompt, buildTrendAnalysisPrompt } from "./prompts";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

function getModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o";
}

async function callOpenAI(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });
  return response.choices[0]?.message?.content || "{}";
}

export const openaiProvider: AiProvider = {
  async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
    const prompt = await buildClassifyPrompt(input);
    const result = await callOpenAI(prompt);
    return JSON.parse(result) as PostClassificationResult;
  },

  async translateText(input: TranslateTextInput): Promise<string> {
    const prompt = buildTranslatePrompt(input);
    const result = await callOpenAI(prompt);
    return (JSON.parse(result) as { translatedText: string }).translatedText;
  },

  async generateDeepDiveSession(input: GenerateDeepDiveSessionInput): Promise<GeneratedDeepDiveSessionResult> {
    const prompt = await buildDeepDivePrompt(input);
    const result = await callOpenAI(prompt);
    return JSON.parse(result) as GeneratedDeepDiveSessionResult;
  },

  async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
    const prompt = await buildOutputPrompt(input);
    const result = await callOpenAI(prompt);
    return JSON.parse(result) as GeneratedOutputResult;
  },

  async searchSemantically(query: string, posts: PostSummaryForSearch[]): Promise<SemanticSearchResult> {
    const prompt = buildSemanticSearchPrompt(query, posts);
    const result = await callOpenAI(prompt);
    return JSON.parse(result) as SemanticSearchResult;
  },

  async analyzeLikeTrends(posts: PostSummaryForTrend[]): Promise<TrendInsight> {
    const prompt = await buildTrendAnalysisPrompt(posts);
    const result = await callOpenAI(prompt);
    return JSON.parse(result) as TrendInsight;
  },

  async chat(message: string, history: ChatMessage[], posts: PostContext[]): Promise<string> {
    const prompt = await buildChatPrompt(message, history, posts);
    return callOpenAI(prompt);
  },
};
