import { xaiChat, getAuthHeader } from "@/lib/xai/client";
import type { LLMClient, ModelInfo, ModelListResult, ProviderConfig } from "./types";

const FALLBACK_MODELS: ModelInfo[] = [
  { id: "grok-3", name: "Grok 3" },
  { id: "grok-3-mini", name: "Grok 3 Mini" },
];

async function fetchGrokModels(authHeader: string): Promise<ModelInfo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://api.x.ai/v1/models", {
      headers: { Authorization: authHeader },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string; created?: number; object?: string }> };
    if (!Array.isArray(data.data)) return [];

    return data.data
      .filter((m) => typeof m.id === "string" && m.id.startsWith("grok-"))
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
      .map((m) => ({ id: m.id, name: m.id }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const modelCache = new Map<string, { models: ModelInfo[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

// apiKey が明示指定されていればそれを Bearer に使う。
// OAuth ("oauth" センチネル or null) の場合は getAuthHeader() で
// OAuth トークン or env キーを解決する。どちらも無ければ fallback。
export async function getGrokModels(apiKey: string | null): Promise<ModelListResult> {
  let authHeader: string | null = null;
  if (apiKey && apiKey !== "oauth") {
    authHeader = `Bearer ${apiKey}`;
  } else {
    try {
      authHeader = await getAuthHeader();
    } catch {
      authHeader = null;
    }
  }
  if (!authHeader) return { models: FALLBACK_MODELS, source: "fallback" };

  const cacheKey = apiKey && apiKey !== "oauth" ? apiKey : "oauth";
  const cached = modelCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { models: cached.models, source: "live" };
  }

  const live = await fetchGrokModels(authHeader);
  if (live.length > 0) {
    modelCache.set(cacheKey, { models: live, fetchedAt: Date.now() });
    return { models: live, source: "live" };
  }
  return { models: FALLBACK_MODELS, source: "fallback" };
}

export function getGrokClient(config: ProviderConfig): LLMClient {
  return {
    async chatJson(prompt, opts) {
      const result = await xaiChat({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        jsonMode: true,
        temperature: opts?.temperature ?? 0.4,
      });
      return result.content || "{}";
    },
    async chatText(prompt, opts) {
      const result = await xaiChat({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: opts?.temperature ?? 0.7,
      });
      return result.content || "";
    },
  };
}
