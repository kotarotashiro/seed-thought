import { after } from "next/server";
import { NextResponse } from "next/server";
import { syncXPosts } from "@/lib/x/sync";
import { enrichPendingPosts } from "@/lib/posts/enrich";
import { generateRecommendations } from "@/lib/x/recommend";
import { generateTrendDigest } from "@/lib/x/trendDigest";
import { refreshStoredXaiTokens } from "@/lib/xai/refresh";
import {
  autoRecommendationsEnabled,
  autoTrendDigestEnabled,
  canRunAutoEnrich,
  canRunAutoXSync,
  isQuotaLikeError,
  isQuotaLikeMessage,
  recordAutoEnrichUsage,
  recordAutoXSyncUsage,
  recordQuotaError,
} from "@/lib/ops/autoRun";

// Vercel Cron: runs every 30 minutes via GET.
// Manual test: curl /api/cron/x-sync -H "Authorization: Bearer $CRON_SECRET"
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decision = await canRunAutoXSync(25);
    if (!decision.allowed) {
      return NextResponse.json({ ok: true, skipped: true, reason: decision.reason });
    }

    const result = await syncXPosts("both", decision.limit, undefined, {
      auto: true,
      enrichWithAi: false,
    });
    await recordAutoXSyncUsage(result.results);

    if (
      isQuotaLikeMessage(result.results.errorMessage) ||
      result.results.partialErrors?.some(isQuotaLikeMessage)
    ) {
      await recordQuotaError(new Error(result.results.errorMessage ?? result.results.partialErrors?.join(" / ")));
    }

    after(async () => {
      try {
        const enrichDecision = await canRunAutoEnrich(10);
        if (!enrichDecision.allowed) return;
        const enrich = await enrichPendingPosts(enrichDecision.limit);
        await recordAutoEnrichUsage(enrich.processedCount);
      } catch (err) {
        if (isQuotaLikeError(err)) {
          await recordQuotaError(err);
        }
        console.error("[cron/x-sync] enrich after failed:", err);
      }
    });
    if (autoRecommendationsEnabled()) {
      after(() => generateRecommendations());
    }
    if (autoTrendDigestEnabled()) {
      after(() => generateTrendDigest());
    }
    // Keep Grok OAuth refresh_token warm — runs in background so it never blocks
    // the X sync response. Failures are logged but don't fail the cron run.
    after(async () => {
      try {
        const refresh = await refreshStoredXaiTokens();
        if (refresh.ok) {
          console.log("[cron/x-sync] grok refresh ok", refresh);
        } else {
          console.log("[cron/x-sync] grok refresh skipped:", refresh.reason);
        }
      } catch (err) {
        console.error("[cron/x-sync] grok refresh failed:", err);
      }
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (isQuotaLikeError(error)) {
      try {
        await recordQuotaError(error);
      } catch (recordError) {
        console.error("[cron/x-sync] quota record failed:", recordError);
      }
    }
    const message = error instanceof Error ? error.message : "sync failed";
    console.error("[cron/x-sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
