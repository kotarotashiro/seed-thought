import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { findXaiAuth } from "@/lib/xai/authStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Keep heartbeat read-only: opening/focusing the app must not consume
    // background DB/API quota through sync or token refresh side effects.
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
