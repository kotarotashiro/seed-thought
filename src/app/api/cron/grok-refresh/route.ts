import { NextResponse } from "next/server";
import { refreshStoredXaiTokens } from "@/lib/xai/refresh";

// Manual / fallback endpoint for refreshing Grok OAuth tokens.
// In production, this is also called from /api/cron/x-sync once per day to stay
// within Vercel Hobby plan cron limits (max 2 cron entries in vercel.json).
// Manual test: curl /api/cron/grok-refresh -H "Authorization: Bearer $CRON_SECRET"
export const runtime = "nodejs";
export const maxDuration = 30;

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
    const force = new URL(request.url).searchParams.get("force") === "1";
    const result = await refreshStoredXaiTokens({ force });
    const benignSkip =
      !result.ok && (result.code === "not_due" || result.code === "concurrent_refresh");

    if (result.ok) {
      console.log("[cron/grok-refresh] refreshed successfully", result);
    } else if (benignSkip) {
      console.log("[cron/grok-refresh] skipped:", result.reason);
    } else {
      console.error("[cron/grok-refresh] action required:", result.reason);
    }

    const status =
      result.ok || benignSkip ? 200 : result.code === "misconfigured" ? 503 : 409;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "refresh failed";
    console.error("[cron/grok-refresh]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
