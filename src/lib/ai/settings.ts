import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/x/tokenStore";

export const AI_SETTING_KEY = "ai";

export type AiProviderName = "gemini" | "openai" | "claude" | "grok" | "kimi" | "mock";

export interface AiSettingsPublic {
  provider: AiProviderName;
  model: string;
  hasApiKey: boolean;
  keySource: "ui" | "env" | "none";
}

export interface AiRuntimeSettings extends AiSettingsPublic {
  apiKey: string | null;
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
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ],
  openai: [
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
  ],
  claude: [
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-sonnet-4-5",
    "claude-3-7-sonnet-latest",
    "claude-3-5-haiku-latest",
  ],
  grok: ["grok-4.3", "grok-4.20", "grok-3", "grok-3-mini"],
  kimi: [
    "kimi-k2.6",
    "kimi-k2.5",
    "kimi-k2-thinking",
    "kimi-k2-thinking-turbo",
    "kimi-k2-0905-preview",
    "kimi-k2-turbo-preview",
    "kimi-k2-0711-preview",
    "moonshot-v1-8k",
    "moonshot-v1-32k",
    "moonshot-v1-128k",
  ],
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
  const provider = String(value || process.env.AI_PROVIDER || "gemini");
  if (["gemini", "openai", "claude", "grok", "kimi", "mock"].includes(provider)) {
    if (process.env.NODE_ENV === "production" && provider === "mock") return "gemini";
    return provider as AiProviderName;
  }
  return "gemini";
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

export function getDefaultModel(provider: AiProviderName): string {
  return envModels[provider] || defaultModels[provider];
}

export function getRecommendedModel(provider: AiProviderName): string {
  return defaultModels[provider];
}

export function getModelPresets(provider: AiProviderName): string[] {
  const envModel = envModels[provider];
  return Array.from(new Set([...modelPresets[provider], ...(envModel ? [envModel] : [])]));
}

export async function getAiRuntimeSettings(): Promise<AiRuntimeSettings> {
  const setting = await prisma.appSetting.findUnique({ where: { key: AI_SETTING_KEY } });
  const stored = readStoredSettings(setting?.valueJson);
  const provider = normalizeProvider(stored.provider);
  const model = stored.model?.trim() || getDefaultModel(provider);
  const uiKey = stored.apiKeyEncrypted ? decryptToken(stored.apiKeyEncrypted) : null;
  const envKey = envKeys[provider] || null;
  const apiKey = uiKey || envKey;

  return {
    provider,
    model,
    apiKey,
    hasApiKey: Boolean(apiKey) || provider === "mock",
    keySource: uiKey ? "ui" : envKey ? "env" : "none",
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
