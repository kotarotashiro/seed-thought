import { prisma } from "@/lib/db/prisma";
import { hasXaiAuthConfigured, xaiSearchX } from "@/lib/xai/client";

const SETTING_KEY = "trend_digest";
const MIN_INTERVAL_HOURS = 23;

async function getTopCategories(limit = 3): Promise<string[]> {
  const rows = await prisma.postClassification.groupBy({
    by: ["primaryCategory"],
    _count: { primaryCategory: true },
    orderBy: { _count: { primaryCategory: "desc" } },
    take: limit,
  });
  return rows.map((r) => r.primaryCategory).filter(Boolean);
}

async function shouldRun(): Promise<boolean> {
  if (!(await hasXaiAuthConfigured())) return false;

  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!setting) return true;

  try {
    const stored = JSON.parse(setting.valueJson) as { generatedAt?: string };
    if (!stored.generatedAt) return true;
    const generatedAt = new Date(stored.generatedAt).getTime();
    return Date.now() - generatedAt > MIN_INTERVAL_HOURS * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

export async function generateTrendDigest(): Promise<void> {
  if (!(await shouldRun())) return;

  const categories = await getTopCategories(3);
  if (categories.length === 0) return;

  const query = `日本語で回答してください。以下のテーマに関するX（旧Twitter）の最新トレンドを3件ずつ教えてください。各トレンドには簡単な説明を付けてください。テーマ: ${categories.join("、")}`;

  const result = await xaiSearchX(query);

  const digest = {
    generatedAt: new Date().toISOString(),
    categories,
    content: result.content,
  };

  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, valueJson: JSON.stringify(digest) },
    update: { valueJson: JSON.stringify(digest) },
  });
}

export async function getTrendDigest(): Promise<{ generatedAt: string; categories: string[]; content: string } | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!setting) return null;

  try {
    const stored = JSON.parse(setting.valueJson) as { generatedAt?: string; categories?: string[]; content?: string };
    if (!stored.generatedAt || !stored.content) return null;
    return {
      generatedAt: stored.generatedAt,
      categories: stored.categories ?? [],
      content: stored.content,
    };
  } catch {
    return null;
  }
}
