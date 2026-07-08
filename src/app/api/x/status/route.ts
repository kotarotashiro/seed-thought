import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getScopes } from "@/lib/x/oauth";

// GET /api/x/status - Get X account connection status and sync history
export async function GET() {
  try {
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.xSyncRun.updateMany({
      where: {
        status: "running",
        startedAt: { lt: staleThreshold },
      },
      data: {
        status: "failed",
        errorMessage:
          "同期がタイムアウトしました。500件など大きい件数では保存を優先するよう改善済みです。もう一度同期してください。",
        finishedAt: new Date(),
      },
    });

    const account = await prisma.xAccount.findFirst({
      select: {
        id: true,
        xUserId: true,
        username: true,
        displayName: true,
        connectedAt: true,
        tokenExpiresAt: true,
        scopesJson: true,
      },
    });

    const syncRuns = await prisma.xSyncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      connected: !!account,
      account,
      syncRuns,
      config: {
        clientIdConfigured: Boolean(process.env.X_CLIENT_ID),
        redirectUri: process.env.X_REDIRECT_URI || "http://localhost:3003/api/x/callback",
        scopes: getScopes().join(" "),
        tokenEncryptionConfigured: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
      },
    });
  } catch (error) {
    console.error("Failed to fetch X status:", error);
    return NextResponse.json({ error: "X接続状態の取得に失敗しました" }, { status: 500 });
  }
}

// DELETE /api/x/status - Disconnect X account
export async function DELETE() {
  try {
    await prisma.xSyncRun.deleteMany();
    await prisma.xAccount.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect X:", error);
    return NextResponse.json({ error: "X接続の解除に失敗しました" }, { status: 500 });
  }
}
