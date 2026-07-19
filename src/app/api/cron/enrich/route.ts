import { NextResponse } from "next/server";
import { enrichPendingPosts } from "@/lib/posts/enrich";
import { backfillAiClassifications } from "@/lib/posts/aiBackfill";
import {
  canRunAutoEnrich,
  isQuotaLikeError,
  recordAutoEnrichUsage,
  canRunAutoClassify,
  recordAutoClassifyUsage,
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
    const enrichDecision = await canRunAutoEnrich(20);
    let urlEnrichedCount = 0;
    if (enrichDecision.allowed) {
      const result = await enrichPendingPosts(enrichDecision.limit);
      urlEnrichedCount = result.processedCount;
      await recordAutoEnrichUsage(result.processedCount);
    }

    const classifyDecision = await canRunAutoClassify(30);
    let aiClassifiedCount = 0;
    if (classifyDecision.allowed) {
      const result = await backfillAiClassifications(undefined, classifyDecision.limit);
      aiClassifiedCount = result.processedCount;
      await recordAutoClassifyUsage(result.processedCount);
    }

    return NextResponse.json({
      ok: true,
      processedCount: urlEnrichedCount,
      aiClassifiedCount,
      urlEnrichSkipped: enrichDecision.allowed ? undefined : enrichDecision.reason,
      aiClassifySkipped: classifyDecision.allowed ? undefined : classifyDecision.reason,
    });
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
