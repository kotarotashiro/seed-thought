import { GoogleGenAI } from "@google/genai";
import type {
  AiProvider,
  ClassifyPostInput,
  PostClassificationResult,
  GenerateDeepDiveSessionInput,
  GeneratedDeepDiveSessionResult,
  GenerateOutputInput,
  GeneratedOutputResult,
} from "./types";
import { buildClassifyPrompt, buildDeepDivePrompt, buildOutputPrompt } from "./prompts";
import { parseAiJson } from "./json";
import {
  isGeneratedDeepDiveSessionResult,
  isGeneratedOutputResult,
  isPostClassificationResult,
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

export const geminiProvider: AiProvider = {
  async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
    const prompt = await buildClassifyPrompt(input);
    const result = await callGemini(prompt);
    const classification = parseAiJson(result, isPostClassificationResult, "投稿分類");
    return mergeClassificationFallback(input.text, classification);
  },

  async generateDeepDiveSession(input: GenerateDeepDiveSessionInput): Promise<GeneratedDeepDiveSessionResult> {
    const prompt = await buildDeepDivePrompt(input);
    const result = await callGemini(prompt);
    return parseAiJson(result, isGeneratedDeepDiveSessionResult, "深掘りセッション");
  },

  async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
    const prompt = await buildOutputPrompt(input);
    const result = await callGemini(prompt);
    return parseAiJson(result, isGeneratedOutputResult, "アウトプット生成");
  },
};
