import { after } from "next/server";
import { NextResponse } from "next/server";
import { syncXPosts } from "@/lib/x/sync";
import { enrichPendingPosts } from "@/lib/posts/enrich";
import { generateRecommendations } from "@/lib/x/recommend";
import { generateTrendDigest } from "@/lib/x/trendDigest";
import { refreshStoredXaiTokens } from "@/lib/xai/refresh";

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
    const result = await syncXPosts("both", 25);
    after(() => enrichPendingPosts(10));
    after(() => generateRecommendations());
    after(() => generateTrendDigest());
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
    const message = error instanceof Error ? error.message : "sync failed";
    console.error("[cron/x-sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
