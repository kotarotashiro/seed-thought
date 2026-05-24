import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/x/tokenStore";

const NOTION_SETTING_KEY = "notion";

interface StoredNotionSettings {
  apiKeyEncrypted?: string;
  databaseId?: string;
}

export interface NotionSettings {
  hasApiKey: boolean;
  databaseId: string;
}

export interface NotionRuntimeSettings extends NotionSettings {
  apiKey: string | null;
}

export async function getNotionSettings(): Promise<NotionRuntimeSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: NOTION_SETTING_KEY } });
  if (!row) return { hasApiKey: false, databaseId: "", apiKey: null };

  const stored = JSON.parse(row.valueJson) as StoredNotionSettings;
  const apiKey = stored.apiKeyEncrypted ? decryptToken(stored.apiKeyEncrypted) : null;

  return {
    hasApiKey: !!apiKey,
    databaseId: stored.databaseId || "",
    apiKey,
  };
}

export async function saveNotionSettings(opts: {
  apiKey?: string;
  databaseId?: string;
  clearApiKey?: boolean;
}): Promise<NotionSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: NOTION_SETTING_KEY } });
  const current: StoredNotionSettings = row ? (JSON.parse(row.valueJson) as StoredNotionSettings) : {};

  if (opts.clearApiKey) {
    current.apiKeyEncrypted = undefined;
  } else if (opts.apiKey) {
    current.apiKeyEncrypted = encryptToken(opts.apiKey);
  }

  if (opts.databaseId !== undefined) {
    current.databaseId = opts.databaseId;
  }

  await prisma.appSetting.upsert({
    where: { key: NOTION_SETTING_KEY },
    create: { key: NOTION_SETTING_KEY, valueJson: JSON.stringify(current) },
    update: { valueJson: JSON.stringify(current) },
  });

  return {
    hasApiKey: !!current.apiKeyEncrypted,
    databaseId: current.databaseId || "",
  };
}
