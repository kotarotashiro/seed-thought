import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import { hasXaiAuthConfigured } from "@/lib/xai/client";

export const AI_SETTING_KEY = "ai";

export type AiProviderName = "grok" | "mock";

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
  grok: "grok-4.3",
  mock: "mock",
};

const modelPresets: Record<AiProviderName, string[]> = {
  grok: ["grok-4.3", "grok-4.20", "grok-3", "grok-3-mini"],
  mock: ["mock"],
};

const envKeys: Record<AiProviderName, string | undefined> = {
  grok: process.env.GROK_API_KEY || process.env.XAI_API_KEY,
  mock: undefined,
};

const envModels: Record<AiProviderName, string | undefined> = {
  grok: process.env.GROK_MODEL || process.env.XAI_MODEL,
  mock: undefined,
};

function normalizeProvider(value: unknown): AiProviderName {
  const provider = String(value || process.env.AI_PROVIDER || "grok");
  if (provider === "mock" && process.env.NODE_ENV !== "production") return "mock";
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
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueModels(models: string[]): string[] {
  return Array.from(new Set(models.map((m) => m.trim()).filter(Boolean)));
}

function getModelSortScore(model: string): number {
  const idx = modelPresets.grok.indexOf(model);
  return idx >= 0 ? idx : 1000;
}

function selectCurrentModels(models: string[], limit = 4): string[] {
  return uniqueModels(models)
    .filter((m) => m.startsWith("grok-"))
    .sort((a, b) => {
      const score = getModelSortScore(a) - getModelSortScore(b);
      return score !== 0 ? score : b.localeCompare(a);
    })
    .slice(0, limit);
}

async function fetchGrokModels(apiKey: string): Promise<string[]> {
  const data = await fetchJson("https://api.x.ai/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!data || typeof data !== "object" || !("data" in data) || !Array.isArray((data as { data: unknown }).data)) {
    return [];
  }
  return (data as { data: Array<{ id?: unknown }> }).data.map((m) =>
    typeof m.id === "string" ? m.id : ""
  );
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
  let liveModels: string[] = [];
  if (provider === "grok" && apiKey) {
    const raw = await fetchGrokModels(apiKey).catch(() => []);
    liveModels = selectCurrentModels(raw);
  }
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
    create: { key: AI_SETTING_KEY, valueJson: JSON.stringify(next) },
    update: { valueJson: JSON.stringify(next) },
  });

  return getAiPublicSettings();
}
