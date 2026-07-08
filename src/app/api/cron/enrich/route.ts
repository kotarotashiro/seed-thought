import { NextResponse } from "next/server";
import { enrichPendingPosts } from "@/lib/posts/enrich";
import {
  canRunAutoEnrich,
  isQuotaLikeError,
  recordAutoEnrichUsage,
  recordQuotaError,
} from "@/lib/ops/autoRun";

// Vercel Cron: retry failed/pending URL enrichments every hour.
// Manual test: curl /api/cron/enrich -H "Authorization: Bearer $CRON_SECRET"
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
    const decision = await canRunAutoEnrich(20);
    if (!decision.allowed) {
      return NextResponse.json({ ok: true, skipped: true, reason: decision.reason });
    }

    const result = await enrichPendingPosts(decision.limit);
    await recordAutoEnrichUsage(result.processedCount);
    return NextResponse.json({ ok: true, processedCount: result.processedCount });
  } catch (error) {
    if (isQuotaLikeError(error)) {
      try {
        await recordQuotaError(error);
      } catch (recordError) {
        console.error("[cron/enrich] quota record failed", recordError);
      }
    }
    const message = error instanceof Error ? error.message : "enrich failed";
    console.error("[cron/enrich]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
