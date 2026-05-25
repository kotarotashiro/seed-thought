import { after } from "next/server";
import { NextResponse } from "next/server";
import { syncXPosts } from "@/lib/x/sync";
import { enrichPendingPosts } from "@/lib/posts/enrich";
import { generateRecommendations } from "@/lib/x/recommend";

// Vercel Cron: runs every 30 minutes via GET.
// Manual test: curl /api/cron/x-sync -H "Authorization: Bearer $CRON_SECRET"
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
    const result = await syncXPosts("both", 25);
    after(() => enrichPendingPosts(10));
    after(() => generateRecommendations());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    console.error("[cron/x-sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
