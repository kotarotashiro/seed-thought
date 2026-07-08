import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import { hasXaiAuthConfigured } from "@/lib/xai/client";
import { getGrokModels } from "./providers/grokProvider";
import { getClaudeModels } from "./providers/claudeProvider";
import { getOpenAIModels } from "./providers/openaiProvider";
import { getGeminiModels } from "./providers/geminiProvider";
import { getKimiModels } from "./providers/kimiProvider";
import type { ModelListResult } from "./providers/types";

export const AI_SETTING_KEY = "ai";

export type AiProviderName = "grok" | "claude" | "openai" | "gemini" | "kimi" | "mock";

export const PROVIDER_LABELS: Record<AiProviderName, string> = {
  grok: "Grok (xAI)",
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  gemini: "Gemini (Google)",
  kimi: "Kimi (Moonshot)",
  mock: "Mock",
};

export type AiTaskName =
  | "classifyPost"
  | "translateText"
  | "generateLearningCard"
  | "generateStrictLearning"
  | "generateOutput"
  | "searchSemantically"
  | "analyzeLikeTrends"
  | "chat";

export const TASK_LABELS: Record<AiTaskName, string> = {
  classifyPost: "投稿分類",
  translateText: "翻訳",
  generateLearningCard: "学習カード生成",
  generateStrictLearning: "厳密学習生成",
  generateOutput: "アウトプット生成",
  searchSemantically: "セマンティック検索",
  analyzeLikeTrends: "傾向分析",
  chat: "チャット",
};

export interface AiTaskAssignment {
  provider: AiProviderName;
  model: string;
}

interface StoredAiSettings {
  // 全工程共通デフォルト
  defaultProvider?: AiProviderName;
  defaultModel?: string;
  // Provider別の暗号化APIキー
  apiKeys?: Partial<Record<AiProviderName, string>>;
  // 工程別の割り当て
  taskAssignments?: Partial<Record<AiTaskName, AiTaskAssignment>>;
  // 旧スキーマ互換（読み込みのみ）
  provider?: AiProviderName;
  model?: string;
  apiKeyEncrypted?: string;
}

export interface AiKeyStatus {
  hasKey: boolean;
  source: "ui" | "env" | "oauth" | "none";
}

export interface AiTaskResolved extends AiTaskAssignment {
  apiKey: string | null;
}

export interface AiRuntimeSettings {
  defaultProvider: AiProviderName;
  defaultModel: string;
  tasks: Record<AiTaskName, AiTaskResolved>;
  keyStatus: Record<AiProviderName, AiKeyStatus>;
}

export interface AiPublicSettings {
  defaultProvider: AiProviderName;
  defaultModel: string;
  taskAssignments: Partial<Record<AiTaskName, AiTaskAssignment>>;
  keyStatus: Record<AiProviderName, Omit<AiKeyStatus, never>>;
}

// 環境変数キー
const ENV_KEYS: Record<AiProviderName, string | undefined> = {
  grok: process.env.GROK_API_KEY || process.env.XAI_API_KEY,
  claude: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  kimi: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY,
  mock: undefined,
};

// デフォルトモデル（実在する既知モデルのみ）
const DEFAULT_MODELS: Record<AiProviderName, string> = {
  grok: "grok-3",
  claude: "claude-sonnet-4-6",
  openai: "gpt-4o",
  gemini: "gemini-3.5-flash",
  kimi: "kimi-k2.6",
  mock: "mock",
};

const ALL_PROVIDERS: AiProviderName[] = ["grok", "claude", "openai", "gemini", "kimi"];
const ALL_TASKS: AiTaskName[] = [
  "classifyPost",
  "translateText",
  "generateLearningCard",
  "generateStrictLearning",
  "generateOutput",
  "searchSemantically",
  "analyzeLikeTrends",
  "chat",
];

function normalizeProvider(value: unknown, fallback: AiProviderName = "grok"): AiProviderName {
  const p = String(value || "");
  const valid: AiProviderName[] = ["grok", "claude", "openai", "gemini", "kimi", "mock"];
  if (!valid.includes(p as AiProviderName)) return fallback;
  if (p === "mock" && process.env.NODE_ENV === "production") return fallback;
  return p as AiProviderName;
}

function readStoredSettings(valueJson: string | null | undefined): StoredAiSettings {
  if (!valueJson) return {};
  try {
    const v = JSON.parse(valueJson);
    return typeof v === "object" && v !== null ? v : {};
  } catch {
    return {};
  }
}

function migrateStoredSettings(stored: StoredAiSettings): StoredAiSettings {
  // 旧 provider/model/apiKeyEncrypted → 新スキーマへマイグレーション
  if (!stored.defaultProvider && stored.provider) {
    const migrated: StoredAiSettings = { ...stored };
    migrated.defaultProvider = normalizeProvider(stored.provider);
    migrated.defaultModel = stored.model;
    if (stored.apiKeyEncrypted && stored.provider) {
      migrated.apiKeys = { [stored.provider]: stored.apiKeyEncrypted };
    }
    return migrated;
  }
  return stored;
}

function getEnvApiKey(provider: AiProviderName): string | null {
  return ENV_KEYS[provider] || null;
}

function getUiApiKey(stored: StoredAiSettings, provider: AiProviderName): string | null {
  const encrypted = stored.apiKeys?.[provider];
  if (!encrypted) return null;
  try {
    return decryptToken(encrypted);
  } catch {
    return null;
  }
}

export function getDefaultModel(provider: AiProviderName): string {
  const envModel =
    provider === "grok"
      ? process.env.GROK_MODEL || process.env.XAI_MODEL
      : provider === "claude"
      ? process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL
      : provider === "openai"
      ? process.env.OPENAI_MODEL
      : provider === "gemini"
      ? process.env.GEMINI_MODEL
      : provider === "kimi"
      ? process.env.KIMI_MODEL || process.env.MOONSHOT_MODEL
      : undefined;
  return envModel || DEFAULT_MODELS[provider];
}

export async function getProviderModelOptions(
  provider: AiProviderName,
  apiKey: string | null
): Promise<ModelListResult> {
  switch (provider) {
    case "grok":   return getGrokModels(apiKey);
    case "claude": return getClaudeModels(apiKey);
    case "openai": return getOpenAIModels(apiKey);
    case "gemini": return getGeminiModels(apiKey);
    case "kimi":   return getKimiModels(apiKey);
    default:       return { models: [], source: "fallback" };
  }
}

export async function getProviderApiKey(provider: AiProviderName): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key: AI_SETTING_KEY } });
  const stored = migrateStoredSettings(readStoredSettings(setting?.valueJson));
  return getUiApiKey(stored, provider) || getEnvApiKey(provider);
}

// 工程別設定を無視して、その場で指定された provider/model を解決する。
// （学習カード生成などで、投稿ごとにモデルを使い分けるための一時的な上書き用）
export async function resolveProviderModel(
  provider: AiProviderName,
  model?: string | null
): Promise<AiTaskResolved> {
  const normalized = normalizeProvider(provider);
  if (normalized === "mock") {
    return { provider: "mock", model: "mock", apiKey: null };
  }
  let apiKey = await getProviderApiKey(normalized); // ui または env キー
  // Grok は OAuth でも動くため、キーが無くても OAuth センチネルを返す
  if (!apiKey && normalized === "grok" && (await hasXaiAuthConfigured())) {
    apiKey = "oauth";
  }
  return {
    provider: normalized,
    model: model?.trim() || getDefaultModel(normalized),
    apiKey,
  };
}

export async function getAiRuntimeSettings(): Promise<AiRuntimeSettings> {
  const setting = await prisma.appSetting.findUnique({ where: { key: AI_SETTING_KEY } });
  const raw = readStoredSettings(setting?.valueJson);
  const stored = migrateStoredSettings(raw);

  const envProvider = process.env.AI_PROVIDER as AiProviderName | undefined;
  const defaultProvider = normalizeProvider(stored.defaultProvider ?? envProvider ?? "grok");
  const defaultModel = stored.defaultModel?.trim() || getDefaultModel(defaultProvider);

  // xAI OAuth
  const hasGrokOAuth =
    defaultProvider === "grok" && !getEnvApiKey("grok") && !getUiApiKey(stored, "grok")
      ? await hasXaiAuthConfigured()
      : false;

  // keyStatus
  const keyStatus = {} as Record<AiProviderName, AiKeyStatus>;
  for (const p of ALL_PROVIDERS) {
    const ui = getUiApiKey(stored, p);
    const env = getEnvApiKey(p);
    const oauth = p === "grok" && !ui && !env ? hasGrokOAuth : false;
    keyStatus[p] = {
      hasKey: Boolean(ui || env || oauth) || p === "mock",
      source: ui ? "ui" : env ? "env" : oauth ? "oauth" : "none",
    };
  }
  keyStatus.mock = { hasKey: true, source: "none" };

  // 各工程のAPIキー取得ヘルパー
  // Grok OAuth の場合は xaiChat が内部で認証を解決するため、
  // "oauth" センチネルを返して apiKey non-null を保証する
  function resolveKey(provider: AiProviderName): string | null {
    const uiOrEnv = getUiApiKey(stored, provider) || getEnvApiKey(provider);
    if (uiOrEnv) return uiOrEnv;
    if (provider === "grok" && hasGrokOAuth) return "oauth";
    return null;
  }

  // 工程別割り当て解決
  const tasks = {} as Record<AiTaskName, AiTaskResolved>;
  for (const task of ALL_TASKS) {
    const assignment = stored.taskAssignments?.[task];
    if (assignment) {
      const provider = normalizeProvider(assignment.provider, defaultProvider);
      const model = assignment.model?.trim() || getDefaultModel(provider);
      const apiKey = resolveKey(provider);
      // APIキーが無い場合はデフォルトにフォールバック
      if (apiKey || provider === "mock" || (provider === "grok" && hasGrokOAuth)) {
        tasks[task] = { provider, model, apiKey };
      } else {
        const fallbackKey = resolveKey(defaultProvider);
        if (fallbackKey || defaultProvider === "mock" || (defaultProvider === "grok" && hasGrokOAuth)) {
          tasks[task] = { provider: defaultProvider, model: defaultModel, apiKey: fallbackKey };
        } else {
          tasks[task] = { provider: "mock", model: "mock", apiKey: null };
        }
        console.warn(
          `[ai/settings] ${task}: provider=${provider} has no API key, falling back to ${tasks[task].provider}`
        );
      }
    } else {
      const apiKey = resolveKey(defaultProvider);
      if (apiKey || defaultProvider === "mock" || (defaultProvider === "grok" && hasGrokOAuth)) {
        tasks[task] = { provider: defaultProvider, model: defaultModel, apiKey };
      } else {
        // どのプロバイダにもキーが無い場合の最終フォールバック
        tasks[task] = { provider: "mock", model: "mock", apiKey: null };
        console.warn(
          `[ai/settings] ${task}: no API key available for ${defaultProvider}, falling back to mock`
        );
      }
    }
  }

  return { defaultProvider, defaultModel, tasks, keyStatus };
}

export async function getAiPublicSettings(): Promise<AiPublicSettings> {
  const setting = await prisma.appSetting.findUnique({ where: { key: AI_SETTING_KEY } });
  const raw = readStoredSettings(setting?.valueJson);
  const stored = migrateStoredSettings(raw);

  const envProvider = process.env.AI_PROVIDER as AiProviderName | undefined;
  const defaultProvider = normalizeProvider(stored.defaultProvider ?? envProvider ?? "grok");
  const defaultModel = stored.defaultModel?.trim() || getDefaultModel(defaultProvider);

  const hasGrokOAuth = await hasXaiAuthConfigured();

  const keyStatus = {} as Record<AiProviderName, AiKeyStatus>;
  for (const p of ALL_PROVIDERS) {
    const ui = getUiApiKey(stored, p);
    const env = getEnvApiKey(p);
    const oauth = p === "grok" && !ui && !env ? hasGrokOAuth : false;
    keyStatus[p] = {
      hasKey: Boolean(ui || env || oauth),
      source: ui ? "ui" : env ? "env" : oauth ? "oauth" : "none",
    };
  }
  keyStatus.mock = { hasKey: true, source: "none" };

  return {
    defaultProvider,
    defaultModel,
    taskAssignments: stored.taskAssignments ?? {},
    keyStatus,
  };
}

export async function saveAiSettings(input: {
  defaultProvider?: AiProviderName;
  defaultModel?: string;
  taskAssignments?: Partial<Record<AiTaskName, AiTaskAssignment | null>>;
  apiKeys?: Partial<Record<AiProviderName, string | null>>;
}): Promise<AiPublicSettings> {
  const current = await prisma.appSetting.findUnique({ where: { key: AI_SETTING_KEY } });
  const raw = readStoredSettings(current?.valueJson);
  const stored = migrateStoredSettings(raw);

  const next: StoredAiSettings = {
    defaultProvider: input.defaultProvider
      ? normalizeProvider(input.defaultProvider)
      : stored.defaultProvider,
    defaultModel: input.defaultModel?.trim() || stored.defaultModel,
    apiKeys: { ...(stored.apiKeys ?? {}) },
    // taskAssignments が渡された場合は「望ましい全体像」として丸ごと置換する
    // （クライアントは default 工程をキーごと省いて送るため、マージだと
    // 「すべてデフォルト」=空オブジェクトを送っても旧割り当てが消えない）。
    // 渡されなければ既存を維持。
    taskAssignments: input.taskAssignments ? {} : { ...(stored.taskAssignments ?? {}) },
  };

  // APIキーの更新
  if (input.apiKeys) {
    for (const [provider, key] of Object.entries(input.apiKeys)) {
      const p = provider as AiProviderName;
      if (key === null) {
        delete next.apiKeys![p];
      } else if (key.trim()) {
        next.apiKeys![p] = encryptToken(key.trim());
      }
    }
  }

  // 工程別割り当ての更新
  if (input.taskAssignments) {
    for (const [task, assignment] of Object.entries(input.taskAssignments)) {
      const t = task as AiTaskName;
      if (assignment === null) {
        delete next.taskAssignments![t];
      } else if (assignment) {
        next.taskAssignments![t] = {
          provider: normalizeProvider(assignment.provider),
          model: assignment.model.trim(),
        };
      }
    }
  }

  await prisma.appSetting.upsert({
    where: { key: AI_SETTING_KEY },
    create: { key: AI_SETTING_KEY, valueJson: JSON.stringify(next) },
    update: { valueJson: JSON.stringify(next) },
  });

  return getAiPublicSettings();
}
