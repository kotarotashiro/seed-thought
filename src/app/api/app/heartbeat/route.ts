import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { findXaiAuth } from "@/lib/xai/authStore";
import { refreshStoredXaiTokens } from "@/lib/xai/refresh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Keep the UI response lightweight, but refresh OAuth in the background
    // while the app is actively used. The hourly GitHub Action is primary.
    after(async () => {
      try {
        const refresh = await refreshStoredXaiTokens();
        if (refresh.ok) console.log("[heartbeat] grok refresh ok", refresh);
      } catch (error) {
        console.error("[heartbeat] grok refresh failed", error);
      }
    });

    const [auth, xAccount, lastSyncRun] = await Promise.all([
      findXaiAuth(),
      prisma.xAccount.findFirst({ select: { id: true } }),
      prisma.xSyncRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: { status: true, startedAt: true },
      }),
    ]);

    const apiKeyAvailable = Boolean(
      process.env.GROK_API_KEY ?? process.env.XAI_API_KEY
    );
    const grokConnected = Boolean(auth);
    const xConnected = Boolean(xAccount);

    const lastSyncAt = lastSyncRun?.startedAt?.toISOString() ?? null;

    return NextResponse.json({
      grok: {
        connected: grokConnected,
        fallbackActive: !grokConnected && apiKeyAvailable,
      },
      x: {
        connected: xConnected,
        lastSyncAt,
      },
    });
  } catch (error) {
    console.error("[heartbeat]", error);
    return NextResponse.json({ error: "heartbeat failed" }, { status: 500 });
  }
}
