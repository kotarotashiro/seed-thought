import OpenAI from "openai";
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
};
