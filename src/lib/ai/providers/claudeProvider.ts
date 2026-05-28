import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient, ModelInfo, ModelListResult, ProviderConfig } from "./types";

const FALLBACK_MODELS: ModelInfo[] = [
  { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
];

async function fetchClaudeModels(apiKey: string): Promise<ModelInfo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
    if (!Array.isArray(data.data)) return [];
    return data.data
      .filter((m) => typeof m.id === "string")
      .map((m) => ({ id: m.id, name: m.display_name || m.id }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const modelCache = new Map<string, { models: ModelInfo[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function getClaudeModels(apiKey: string | null): Promise<ModelListResult> {
  if (!apiKey) return { models: FALLBACK_MODELS, source: "fallback" };

  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { models: cached.models, source: "live" };
  }

  const live = await fetchClaudeModels(apiKey);
  if (live.length > 0) {
    modelCache.set(apiKey, { models: live, fetchedAt: Date.now() });
    return { models: live, source: "live" };
  }
  return { models: FALLBACK_MODELS, source: "fallback" };
}

export function getClaudeClient(config: ProviderConfig): LLMClient {
  const client = new Anthropic({ apiKey: config.apiKey });

  async function call(prompt: string, temperature: number): Promise<string> {
    const message = await client.messages.create({
      model: config.model,
      max_tokens: 8192,
      temperature,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    return block?.type === "text" ? block.text : "";
  }

  return {
    async chatJson(prompt, opts) {
      return call(prompt, opts?.temperature ?? 0.4);
    },
    async chatText(prompt, opts) {
      return call(prompt, opts?.temperature ?? 0.7);
    },
  };
}
