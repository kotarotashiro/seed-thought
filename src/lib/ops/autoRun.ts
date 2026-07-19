import { prisma } from "@/lib/db/prisma";

const QUOTA_STATE_KEY = "ops_quota_state";
const USAGE_KEY_PREFIX = "ops_usage:";

export interface AutoRunDecision {
  allowed: boolean;
  reason?: string;
  limit: number;
}

interface QuotaState {
  blockedUntil?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
}

interface DailyUsage {
  date: string;
  autoXSyncRuns: number;
  autoXFetched: number;
  autoXInserted: number;
  autoEnrichRuns: number;
  autoEnrichItems: number;
  autoClassifyRuns: number;
  autoClassifyItems: number;
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function envInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function nextUtcDayStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

function usageKey(date = utcDay()): string {
  return `${USAGE_KEY_PREFIX}${date}`;
}

function emptyUsage(date = utcDay()): DailyUsage {
  return {
    date,
    autoXSyncRuns: 0,
    autoXFetched: 0,
    autoXInserted: 0,
    autoEnrichRuns: 0,
    autoEnrichItems: 0,
    autoClassifyRuns: 0,
    autoClassifyItems: 0,
  };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

async function readQuotaState(): Promise<QuotaState> {
  const row = await prisma.appSetting.findUnique({ where: { key: QUOTA_STATE_KEY } });
  return parseJson<QuotaState>(row?.valueJson, {});
}

async function readDailyUsage(): Promise<DailyUsage> {
  const date = utcDay();
  const row = await prisma.appSetting.findUnique({ where: { key: usageKey(date) } });
  return parseJson<DailyUsage>(row?.valueJson, emptyUsage(date));
}

async function writeDailyUsage(usage: DailyUsage): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: usageKey(usage.date) },
    create: { key: usageKey(usage.date), valueJson: JSON.stringify(usage) },
    update: { valueJson: JSON.stringify(usage) },
  });
}

export function isQuotaLikeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return isQuotaLikeMessage(message);
}

export function isQuotaLikeMessage(message: string | null | undefined): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("compute time quota") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("rate-limit") ||
    normalized.includes("rate limit") ||
    normalized.includes("code\":429") ||
    normalized.includes("http 429")
  );
}

export async function recordQuotaError(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error ?? "quota-like error");
  const state: QuotaState = {
    blockedUntil: nextUtcDayStart().toISOString(),
    lastErrorAt: new Date().toISOString(),
    lastErrorMessage: message.slice(0, 500),
  };
  await prisma.appSetting.upsert({
    where: { key: QUOTA_STATE_KEY },
    create: { key: QUOTA_STATE_KEY, valueJson: JSON.stringify(state) },
    update: { valueJson: JSON.stringify(state) },
  });
}

async function quotaBlockReason(): Promise<string | null> {
  const state = await readQuotaState();
  if (!state.blockedUntil) return null;
  const blockedUntil = new Date(state.blockedUntil).getTime();
  if (!Number.isFinite(blockedUntil) || blockedUntil <= Date.now()) return null;
  return `quota blocked until ${state.blockedUntil}`;
}

export async function canRunAutoXSync(requestedLimit: number): Promise<AutoRunDecision> {
  if (!envFlag("AUTO_X_SYNC_ENABLED", false)) {
    return { allowed: false, reason: "AUTO_X_SYNC_ENABLED is off", limit: 0 };
  }

  const quotaReason = await quotaBlockReason();
  if (quotaReason) return { allowed: false, reason: quotaReason, limit: 0 };

  const dailyLimit = envInt("DAILY_AUTO_X_FETCH_LIMIT", 10);
  if (dailyLimit <= 0) {
    return { allowed: false, reason: "DAILY_AUTO_X_FETCH_LIMIT is 0", limit: 0 };
  }

  const usage = await readDailyUsage();
  const remaining = Math.max(0, dailyLimit - usage.autoXFetched);
  if (remaining <= 0) {
    return { allowed: false, reason: "daily auto X fetch limit reached", limit: 0 };
  }

  return { allowed: true, limit: Math.min(requestedLimit, remaining) };
}

export async function recordAutoXSyncUsage(result: {
  fetchedCount: number;
  insertedCount: number;
}): Promise<void> {
  const usage = await readDailyUsage();
  usage.autoXSyncRuns += 1;
  usage.autoXFetched += Math.max(0, result.fetchedCount);
  usage.autoXInserted += Math.max(0, result.insertedCount);
  await writeDailyUsage(usage);
}

export async function canRunAutoEnrich(requestedLimit: number): Promise<AutoRunDecision> {
  if (!envFlag("AUTO_ENRICH_ENABLED", true)) {
    return { allowed: false, reason: "AUTO_ENRICH_ENABLED is off", limit: 0 };
  }

  const quotaReason = await quotaBlockReason();
  if (quotaReason) return { allowed: false, reason: quotaReason, limit: 0 };

  const dailyLimit = envInt("DAILY_AUTO_ENRICH_LIMIT", 20);
  if (dailyLimit <= 0) {
    return { allowed: false, reason: "DAILY_AUTO_ENRICH_LIMIT is 0", limit: 0 };
  }

  const usage = await readDailyUsage();
  const remaining = Math.max(0, dailyLimit - usage.autoEnrichItems);
  if (remaining <= 0) {
    return { allowed: false, reason: "daily auto enrich limit reached", limit: 0 };
  }

  return { allowed: true, limit: Math.min(requestedLimit, remaining) };
}

export async function recordAutoEnrichUsage(processedCount: number): Promise<void> {
  const usage = await readDailyUsage();
  usage.autoEnrichRuns += 1;
  usage.autoEnrichItems += Math.max(0, processedCount);
  await writeDailyUsage(usage);
}

export async function canRunAutoClassify(requestedLimit: number): Promise<AutoRunDecision> {
  if (!envFlag("AUTO_ENRICH_ENABLED", true)) {
    return { allowed: false, reason: "AUTO_ENRICH_ENABLED is off", limit: 0 };
  }

  const quotaReason = await quotaBlockReason();
  if (quotaReason) return { allowed: false, reason: quotaReason, limit: 0 };

  const dailyLimit = envInt("DAILY_AUTO_CLASSIFY_LIMIT", 30);
  if (dailyLimit <= 0) {
    return { allowed: false, reason: "DAILY_AUTO_CLASSIFY_LIMIT is 0", limit: 0 };
  }

  const usage = await readDailyUsage();
  const remaining = Math.max(0, dailyLimit - usage.autoClassifyItems);
  if (remaining <= 0) {
    return { allowed: false, reason: "daily auto classify limit reached", limit: 0 };
  }

  return { allowed: true, limit: Math.min(requestedLimit, remaining) };
}

export async function recordAutoClassifyUsage(processedCount: number): Promise<void> {
  const usage = await readDailyUsage();
  usage.autoClassifyRuns += 1;
  usage.autoClassifyItems += Math.max(0, processedCount);
  await writeDailyUsage(usage);
}

export function autoRecommendationsEnabled(): boolean {
  return envFlag("AUTO_RECOMMEND_ENABLED", false);
}

export function autoTrendDigestEnabled(): boolean {
  return envFlag("AUTO_TREND_DIGEST_ENABLED", false);
}

