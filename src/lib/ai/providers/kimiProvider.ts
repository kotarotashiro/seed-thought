import OpenAI from "openai";
import type { LLMClient, ModelInfo, ModelListResult, ProviderConfig } from "./types";

const KIMI_BASE_URL = "https://api.moonshot.cn/v1";

const FALLBACK_MODELS: ModelInfo[] = [
  { id: "moonshot-v1-128k", name: "Moonshot v1 128k" },
  { id: "moonshot-v1-32k", name: "Moonshot v1 32k" },
  { id: "moonshot-v1-8k", name: "Moonshot v1 8k" },
];

async function fetchKimiModels(apiKey: string): Promise<ModelInfo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${KIMI_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    if (!Array.isArray(data.data)) return [];
    return data.data
      .filter((m) => typeof m.id === "string")
      .map((m) => ({ id: m.id, name: m.id }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const modelCache = new Map<string, { models: ModelInfo[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function getKimiModels(apiKey: string | null): Promise<ModelListResult> {
  if (!apiKey) return { models: FALLBACK_MODELS, source: "fallback" };

  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { models: cached.models, source: "live" };
  }

  const live = await fetchKimiModels(apiKey);
  if (live.length > 0) {
    modelCache.set(apiKey, { models: live, fetchedAt: Date.now() });
    return { models: live, source: "live" };
  }
  return { models: FALLBACK_MODELS, source: "fallback" };
}

export function getKimiClient(config: ProviderConfig): LLMClient {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: KIMI_BASE_URL });

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
