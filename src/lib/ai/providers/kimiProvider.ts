import OpenAI from "openai";
import type { LLMClient, ModelInfo, ModelListResult, ProviderConfig } from "./types";

// Moonshot / OpenAI SDK が投げる例外を、UIに出して原因が分かる文字列に整形する。
// SDK の APIError は status / code / message / error.message を持つ。
function describeKimiError(baseUrl: string, model: string, err: unknown): Error {
  type ApiErrorLike = {
    status?: number;
    code?: string;
    message?: string;
    error?: { message?: string; code?: string; type?: string };
  };
  const e = err as ApiErrorLike;
  const status = e?.status ? `HTTP ${e.status}` : "";
  const apiMsg = e?.error?.message || e?.message || "";
  const apiCode = e?.error?.code || e?.code || "";
  const host = (() => {
    try { return new URL(baseUrl).host; } catch { return baseUrl; }
  })();
  const parts = [
    `Kimi (${host}) / model=${model}`,
    status,
    apiCode ? `code=${apiCode}` : "",
    apiMsg,
  ].filter(Boolean);
  const wrapped = new Error(parts.join(" — "));
  (wrapped as Error & { cause?: unknown }).cause = err;
  return wrapped;
}

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

  // モデルが response_format=json_object を拒否した履歴をプロセスメモリで保持。
  // 一度拒否されたら、その後は最初から json_object を付けずに呼ぶ。
  const modelsRejectingJsonMode = new Set<string>();
  // 同様に、temperature を指定すると拒否されるモデル（kimi-k2.X 系は temperature=1 固定）
  const modelsRequiringFixedTemperature = new Set<string>();

  // 仕様として最初から temperature を送らないモデル群（公式ドキュメントで判明している分）
  // kimi-k2.6 / kimi-k2.5: only temperature=1 is allowed → 送らない方が事故が少ない
  function modelRejectsCustomTemperature(model: string): boolean {
    return (
      modelsRequiringFixedTemperature.has(model) ||
      /^kimi-k2\.\d+/.test(model) // kimi-k2.6, kimi-k2.5 など "k2.数字"系
    );
  }

  function isJsonModeUnsupportedError(err: unknown): boolean {
    const e = err as { status?: number; error?: { message?: string }; message?: string };
    if (e?.status !== 400) return false;
    const msg = (e?.error?.message || e?.message || "").toLowerCase();
    return (
      msg.includes("response_format") ||
      msg.includes("json_object") ||
      msg.includes("json mode") ||
      msg.includes("json schema") ||
      (msg.includes("not support") && !msg.includes("temperature"))
    );
  }

  function isTemperatureUnsupportedError(err: unknown): boolean {
    const e = err as { status?: number; error?: { message?: string }; message?: string };
    if (e?.status !== 400) return false;
    const msg = (e?.error?.message || e?.message || "").toLowerCase();
    return msg.includes("temperature");
  }

  // .cn にフォールバックする価値があるのは「キーが .ai では通らない＝認証エラー」のときだけ。
  // 400 (パラメータエラー) や 404 (モデル無し) は .cn にしても直らないので無駄。
  function isAuthErrorWorthFallback(err: unknown): boolean {
    const e = err as { status?: number };
    return e?.status === 401 || e?.status === 403;
  }

  async function callOnce(baseUrl: string, prompt: string, opts: { temperature: number; json: boolean }) {
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: baseUrl });
    const useJsonMode = opts.json && !modelsRejectingJsonMode.has(config.model);
    const sendTemperature = !modelRejectsCustomTemperature(config.model);

    const baseParams = {
      model: config.model,
      messages: [{ role: "user" as const, content: prompt }],
      ...(sendTemperature ? { temperature: opts.temperature } : {}),
      ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
    };

    try {
      return await client.chat.completions.create(baseParams);
    } catch (err) {
      // temperature 非対応（kimi-k2.6 等）→ 学習し、temperatureを抜いて再試行
      if (sendTemperature && isTemperatureUnsupportedError(err)) {
        modelsRequiringFixedTemperature.add(config.model);
        console.warn(
          `[kimiProvider] model=${config.model} rejected custom temperature on ${baseUrl}; retrying without temperature`
        );
        const { temperature: _t, ...rest } = baseParams;
        void _t;
        return await client.chat.completions.create(rest);
      }
      // json_object 非対応モデル → JSON指示はプロンプトに残したまま素のテキストで再試行
      if (useJsonMode && isJsonModeUnsupportedError(err)) {
        modelsRejectingJsonMode.add(config.model);
        console.warn(
          `[kimiProvider] model=${config.model} rejected response_format=json_object on ${baseUrl}; retrying without it`
        );
        const { response_format: _rf, ...rest } = baseParams;
        void _rf;
        return await client.chat.completions.create(rest);
      }
      throw err;
    }
  }

  async function callWithFallback(prompt: string, opts: { temperature: number; json: boolean }) {
    const first = pickBaseUrl();
    try {
      const res = await callOnce(first, prompt, opts);
      apiKeyToBaseUrl.set(config.apiKey, first);
      return res;
    } catch (err) {
      // env で明示指定があればフォールバックしない
      if (getConfiguredBaseUrl()) throw describeKimiError(first, config.model, err);
      // 認証エラー以外（400/404 等）は .cn に切り替えても直らないので即throw
      if (!isAuthErrorWorthFallback(err)) throw describeKimiError(first, config.model, err);
      const other = KIMI_BASE_URLS.find((u) => u !== first);
      if (!other) throw describeKimiError(first, config.model, err);
      console.warn(
        `[kimiProvider] ${first} auth failed, retrying on ${other}:`,
        err instanceof Error ? err.message : err
      );
      try {
        const res = await callOnce(other, prompt, opts);
        apiKeyToBaseUrl.set(config.apiKey, other);
        return res;
      } catch (err2) {
        // 両エンドポイント失敗。両方の原因を表示する（.ai/.cn どちらの問題か切り分けられる）。
        const firstDetail = describeKimiError(first, config.model, err).message;
        const secondDetail = describeKimiError(other, config.model, err2).message;
        const combined = new Error(`${secondDetail} | (前段でも失敗) ${firstDetail}`);
        (combined as Error & { cause?: unknown }).cause = err2;
        throw combined;
      }
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
