import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import { hasXaiAuthConfigured } from "@/lib/xai/client";

export const AI_SETTING_KEY = "ai";

export type AiProviderName = "gemini" | "openai" | "claude" | "grok" | "kimi" | "mock";

export interface AiSettingsPublic {
  provider: AiProviderName;
  model: string;
  hasApiKey: boolean;
  keySource: "ui" | "env" | "oauth" | "none";
}

export interface AiRuntimeSettings extends AiSettingsPublic {
  apiKey: string | null;
}

export interface AiProviderModelOptions {
  defaultModel: string;
  models: string[];
  source: "live" | "fallback";
}

interface StoredAiSettings {
  provider?: AiProviderName;
  model?: string;
  apiKeyEncrypted?: string;
}

const defaultModels: Record<AiProviderName, string> = {
  gemini: "gemini-3.1-pro-preview",
  openai: "gpt-5.5",
  claude: "claude-sonnet-4-6",
  grok: "grok-4.3",
  kimi: "kimi-k2.6",
  mock: "mock",
};

const modelPresets: Record<AiProviderName, string[]> = {
  gemini: [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
  ],
  openai: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.2"],
  claude: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5", "claude-sonnet-4-5"],
  grok: ["grok-4.3", "grok-4.20", "grok-3", "grok-3-mini"],
  kimi: ["kimi-k2.6", "kimi-k2.5", "kimi-k2-thinking", "kimi-k2-thinking-turbo"],
  mock: ["mock"],
};

const envKeys: Record<AiProviderName, string | undefined> = {
  gemini: process.env.GEMINI_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  claude: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
  grok: process.env.GROK_API_KEY || process.env.XAI_API_KEY,
  kimi: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY,
  mock: undefined,
};

const envModels: Record<AiProviderName, string | undefined> = {
  gemini: process.env.GEMINI_MODEL,
  openai: process.env.OPENAI_MODEL,
  claude: process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL,
  grok: process.env.GROK_MODEL || process.env.XAI_MODEL,
  kimi: process.env.KIMI_MODEL || process.env.MOONSHOT_MODEL,
  mock: undefined,
};

function normalizeProvider(value: unknown): AiProviderName {
  const provider = String(value || process.env.AI_PROVIDER || "grok");
  if (["gemini", "openai", "claude", "grok", "kimi", "mock"].includes(provider)) {
    if (process.env.NODE_ENV === "production" && provider === "mock") return "grok";
    return provider as AiProviderName;
  }
  return "grok";
}

function readStoredSettings(valueJson: string | null | undefined): StoredAiSettings {
  if (!valueJson) return {};
  try {
    const value = JSON.parse(valueJson);
    return typeof value === "object" && value !== null ? value : {};
  } catch {
    return {};
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function uniqueModels(models: string[]): string[] {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

function getModelSortScore(provider: AiProviderName, model: string): number {
  const presetIndex = modelPresets[provider].indexOf(model);
  if (presetIndex >= 0) return presetIndex;
  return 1000;
}

function selectCurrentModels(provider: AiProviderName, models: string[], limit = 4): string[] {
  return uniqueModels(models)
    .filter((model) => {
      if (provider === "gemini") return model.startsWith("gemini-") && !model.includes("embedding");
      if (provider === "openai") return model.startsWith("gpt-");
      if (provider === "claude") return model.startsWith("claude-");
      if (provider === "grok") return model.startsWith("grok-");
      if (provider === "kimi") return model.startsWith("kimi-");
      return model === "mock";
    })
    .sort((a, b) => {
      const score = getModelSortScore(provider, a) - getModelSortScore(provider, b);
      return score !== 0 ? score : b.localeCompare(a);
    })
    .slice(0, limit);
}

async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );
  if (!data || typeof data !== "object" || !("models" in data) || !Array.isArray(data.models)) {
    return [];
  }

  return data.models
    .filter((model: { name?: unknown; supportedGenerationMethods?: unknown }) => {
      return isStringArray(model.supportedGenerationMethods)
        ? model.supportedGenerationMethods.includes("generateContent")
        : true;
    })
    .map((model: { name?: unknown }) =>
      typeof model.name === "string" ? model.name.replace(/^models\//, "") : ""
    );
}

async function fetchOpenAiCompatibleModels(provider: AiProviderName, apiKey: string): Promise<string[]> {
  const baseUrl =
    provider === "grok"
      ? "https://api.x.ai/v1"
      : provider === "kimi"
      ? "https://api.moonshot.ai/v1"
      : "https://api.openai.com/v1";
  const data = await fetchJson(`${baseUrl}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });

  if (!data || typeof data !== "object" || !("data" in data) || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((model: { id?: unknown }) => (typeof model.id === "string" ? model.id : ""));
}

async function fetchClaudeModels(apiKey: string): Promise<string[]> {
  const data = await fetchJson("https://api.anthropic.com/v1/models?limit=20", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });

  if (!data || typeof data !== "object" || !("data" in data) || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((model: { id?: unknown }) => (typeof model.id === "string" ? model.id : ""));
}

async function fetchLiveModels(provider: AiProviderName, apiKey: string | null): Promise<string[]> {
  if (!apiKey || provider === "mock") return [];

  try {
    if (provider === "gemini") return fetchGeminiModels(apiKey);
    if (provider === "claude") return fetchClaudeModels(apiKey);
    return fetchOpenAiCompatibleModels(provider, apiKey);
  } catch (error) {
    console.warn(`Failed to fetch ${provider} models:`, error);
    return [];
  }
}

export function getDefaultModel(provider: AiProviderName): string {
  return envModels[provider] || defaultModels[provider];
}

export function getRecommendedModel(provider: AiProviderName): string {
  return defaultModels[provider];
}

export function getEnvApiKey(provider: AiProviderName): string | null {
  return envKeys[provider] || null;
}

export function getModelPresets(provider: AiProviderName): string[] {
  const envModel = envModels[provider];
  return Array.from(new Set([...modelPresets[provider], ...(envModel ? [envModel] : [])]));
}

export async function getProviderModelOptions(
  provider: AiProviderName,
  apiKey: string | null
): Promise<AiProviderModelOptions> {
  const fallbackModels = getModelPresets(provider);
  const liveModels = selectCurrentModels(provider, await fetchLiveModels(provider, apiKey));
  const models = liveModels.length > 0 ? liveModels : fallbackModels;

  return {
    defaultModel: models[0] || getRecommendedModel(provider),
    models,
    source: liveModels.length > 0 ? "live" : "fallback",
  };
}

export async function getAiRuntimeSettings(): Promise<AiRuntimeSettings> {
  const setting = await prisma.appSetting.findUnique({ where: { key: AI_SETTING_KEY } });
  const stored = readStoredSettings(setting?.valueJson);
  const provider = normalizeProvider(stored.provider);
  const model = stored.model?.trim() || getDefaultModel(provider);
  const uiKey = stored.apiKeyEncrypted ? decryptToken(stored.apiKeyEncrypted) : null;
  const envKey = envKeys[provider] || null;
  const apiKey = uiKey || envKey;
  const hasOAuth = provider === "grok" && !apiKey ? await hasXaiAuthConfigured() : false;

  return {
    provider,
    model,
    apiKey,
    hasApiKey: Boolean(apiKey) || hasOAuth || provider === "mock",
    keySource: uiKey ? "ui" : envKey ? "env" : hasOAuth ? "oauth" : "none",
  };
}

export async function getAiPublicSettings(): Promise<AiSettingsPublic> {
  const settings = await getAiRuntimeSettings();
  return {
    provider: settings.provider,
    model: settings.model,
    hasApiKey: settings.hasApiKey,
    keySource: settings.keySource,
  };
}

export async function saveAiSettings(input: {
  provider: AiProviderName;
  model?: string;
  apiKey?: string;
  clearApiKey?: boolean;
}): Promise<AiSettingsPublic> {
  const current = await prisma.appSetting.findUnique({ where: { key: AI_SETTING_KEY } });
  const stored = readStoredSettings(current?.valueJson);
  const provider = normalizeProvider(input.provider);
  const next: StoredAiSettings = {
    provider,
    model: input.model?.trim() || getDefaultModel(provider),
    apiKeyEncrypted: stored.apiKeyEncrypted,
  };

  if (input.clearApiKey) {
    delete next.apiKeyEncrypted;
  } else if (input.apiKey?.trim()) {
    next.apiKeyEncrypted = encryptToken(input.apiKey.trim());
  }

  await prisma.appSetting.upsert({
    where: { key: AI_SETTING_KEY },
    create: {
      key: AI_SETTING_KEY,
      valueJson: JSON.stringify(next),
    },
    update: {
      valueJson: JSON.stringify(next),
    },
  });

  return getAiPublicSettings();
}
