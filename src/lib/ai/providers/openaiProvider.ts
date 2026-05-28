import OpenAI from "openai";
import type { LLMClient, ModelInfo, ModelListResult, ProviderConfig } from "./types";

const FALLBACK_MODELS: ModelInfo[] = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
];

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[openaiProvider] /v1/models returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { data?: Array<{ id: string; created?: number }> };
    if (!Array.isArray(data.data)) return [];
    return data.data
      .filter((m) => typeof m.id === "string" && /^(gpt-|o[1-9])/.test(m.id) && !m.id.includes("instruct") && !m.id.includes("audio") && !m.id.includes("realtime") && !m.id.includes("transcribe") && !m.id.includes("tts") && !m.id.includes("image"))
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
      .map((m) => ({ id: m.id, name: m.id }));
  } catch (err) {
    console.warn("[openaiProvider] failed to fetch models:", err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const modelCache = new Map<string, { models: ModelInfo[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function getOpenAIModels(apiKey: string | null): Promise<ModelListResult> {
  if (!apiKey) return { models: FALLBACK_MODELS, source: "fallback" };

  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { models: cached.models, source: "live" };
  }

  const live = await fetchOpenAIModels(apiKey);
  if (live.length > 0) {
    modelCache.set(apiKey, { models: live, fetchedAt: Date.now() });
    return { models: live, source: "live" };
  }
  return { models: FALLBACK_MODELS, source: "fallback" };
}

export function getOpenAIClient(config: ProviderConfig): LLMClient {
  const client = new OpenAI({ apiKey: config.apiKey });

  return {
    async chatJson(prompt, opts) {
      const res = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: opts?.temperature ?? 0.4,
        response_format: { type: "json_object" },
      });
      return res.choices[0]?.message?.content || "{}";
    },
    async chatText(prompt, opts) {
      const res = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: opts?.temperature ?? 0.7,
      });
      return res.choices[0]?.message?.content || "";
    },
  };
}
