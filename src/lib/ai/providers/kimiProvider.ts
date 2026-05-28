import OpenAI from "openai";
import type { LLMClient, ModelInfo, ModelListResult, ProviderConfig } from "./types";

// Moonshot は .ai (国際版) と .cn (中国版) の2系統があり、APIキーは別物。
// 環境変数 KIMI_BASE_URL が指定されればそれを優先。
// 未指定なら .ai → .cn の順で /v1/models を叩いてキーが通る方を採用する。
const KIMI_BASE_URLS = ["https://api.moonshot.ai/v1", "https://api.moonshot.cn/v1"];

function getConfiguredBaseUrl(): string | null {
  const env = process.env.KIMI_BASE_URL || process.env.MOONSHOT_BASE_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  return null;
}

// 実在する Moonshot/Kimi モデルID（2026/5現在の公式モデル）
// 参考: https://platform.kimi.ai/docs/ （旧 platform.moonshot.ai）
// kimi-k2-0905-preview / kimi-k2-0711-preview / kimi-latest / kimi-thinking-preview は
// 2025-2026にかけて公式廃止済みなので含めないこと。
const FALLBACK_MODELS: ModelInfo[] = [
  { id: "kimi-k2.6", name: "Kimi K2.6" },
  { id: "kimi-k2.5", name: "Kimi K2.5" },
  { id: "moonshot-v1-128k", name: "Moonshot v1 128k" },
  { id: "moonshot-v1-32k", name: "Moonshot v1 32k" },
  { id: "moonshot-v1-8k", name: "Moonshot v1 8k" },
];

async function fetchKimiModelsFrom(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[kimiProvider] ${baseUrl}/models returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    if (!Array.isArray(data.data)) return [];
    return data.data
      .filter((m) => typeof m.id === "string")
      .map((m) => ({ id: m.id, name: m.id }));
  } catch (err) {
    console.warn(`[kimiProvider] failed to fetch models from ${baseUrl}:`, err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// プロセスメモリで「このキーはどっちの base URL で通ったか」を覚えておく
const apiKeyToBaseUrl = new Map<string, string>();

async function resolveBaseUrlForKey(apiKey: string): Promise<{ baseUrl: string; models: ModelInfo[] } | null> {
  const configured = getConfiguredBaseUrl();
  const candidates = configured ? [configured] : KIMI_BASE_URLS;
  for (const baseUrl of candidates) {
    const models = await fetchKimiModelsFrom(baseUrl, apiKey);
    if (models.length > 0) {
      apiKeyToBaseUrl.set(apiKey, baseUrl);
      return { baseUrl, models };
    }
  }
  return null;
}

const modelCache = new Map<string, { models: ModelInfo[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function getKimiModels(apiKey: string | null): Promise<ModelListResult> {
  if (!apiKey) return { models: FALLBACK_MODELS, source: "fallback" };

  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { models: cached.models, source: "live" };
  }

  const resolved = await resolveBaseUrlForKey(apiKey);
  if (resolved && resolved.models.length > 0) {
    modelCache.set(apiKey, { models: resolved.models, fetchedAt: Date.now() });
    return { models: resolved.models, source: "live" };
  }
  return { models: FALLBACK_MODELS, source: "fallback" };
}

export function getKimiClient(config: ProviderConfig): LLMClient {
  // ベースURLは①明示env ②過去にキー検証で通ったURL ③.ai → .cn の順
  function pickBaseUrl(): string {
    const configured = getConfiguredBaseUrl();
    if (configured) return configured;
    const cached = apiKeyToBaseUrl.get(config.apiKey);
    if (cached) return cached;
    return KIMI_BASE_URLS[0];
  }

  async function callOnce(baseUrl: string, prompt: string, opts: { temperature: number; json: boolean }) {
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: baseUrl });
    return client.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: opts.temperature,
      ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    });
  }

  async function callWithFallback(prompt: string, opts: { temperature: number; json: boolean }) {
    const first = pickBaseUrl();
    try {
      const res = await callOnce(first, prompt, opts);
      apiKeyToBaseUrl.set(config.apiKey, first);
      return res;
    } catch (err) {
      // env で明示指定があればフォールバックしない
      if (getConfiguredBaseUrl()) throw err;
      const other = KIMI_BASE_URLS.find((u) => u !== first);
      if (!other) throw err;
      console.warn(
        `[kimiProvider] ${first} failed, retrying on ${other}:`,
        err instanceof Error ? err.message : err
      );
      const res = await callOnce(other, prompt, opts);
      apiKeyToBaseUrl.set(config.apiKey, other);
      return res;
    }
  }

  return {
    async chatJson(prompt, opts) {
      const res = await callWithFallback(prompt, {
        temperature: opts?.temperature ?? 0.4,
        json: true,
      });
      return res.choices[0]?.message?.content || "{}";
    },
    async chatText(prompt, opts) {
      const res = await callWithFallback(prompt, {
        temperature: opts?.temperature ?? 0.7,
        json: false,
      });
      return res.choices[0]?.message?.content || "";
    },
  };
}
