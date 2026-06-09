import { after } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { findXaiAuth } from "@/lib/xai/authStore";
import { refreshStoredXaiTokens } from "@/lib/xai/refresh";
import { syncXPosts } from "@/lib/x/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** X同期のクールダウン: 6時間 */
const SYNC_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export async function GET() {
  try {
    // ── 1. 接続状態を即取得 ─────────────────────────────────────────────────
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

    // ── 2. 副作用を after() で非同期実行（レスポンスをブロックしない） ───────
    after(async () => {
      // 2a. Grokトークン延命（失敗は握りつぶし）
      try {
        await refreshStoredXaiTokens();
      } catch (err) {
        console.error("[heartbeat] grok refresh error:", err);
      }
    });

    after(async () => {
      // 2b. X同期スロットル: 接続済み + クールダウン経過 + 実行中でない場合のみ
      if (!xConnected) return;
      if (lastSyncRun?.status === "running") return;
      if (
        lastSyncRun &&
        Date.now() - new Date(lastSyncRun.startedAt).getTime() < SYNC_COOLDOWN_MS
      ) {
        return;
      }

      try {
        await syncXPosts("both", 25);
      } catch (err) {
        console.error("[heartbeat] x sync error:", err);
      }
    });

    // ── 3. 即座にレスポンスを返す ────────────────────────────────────────────
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
