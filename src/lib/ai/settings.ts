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
  gemini: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  claude: "claude-sonnet-4-5",
  grok: "grok-4",
  kimi: "kimi-k2-0711-preview",
  mock: "mock",
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
