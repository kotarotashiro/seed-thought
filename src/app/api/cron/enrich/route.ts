import { NextResponse } from "next/server";
import { enrichPendingPosts } from "@/lib/posts/enrich";

// Vercel Cron: retry failed/pending URL enrichments every hour.
// Manual test: curl /api/cron/enrich -H "Authorization: Bearer $CRON_SECRET"
export const maxDuration = 60;

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
    await enrichPendingPosts(20);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "enrich failed";
    console.error("[cron/enrich]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
