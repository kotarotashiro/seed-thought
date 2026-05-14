import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/x/status - Get X account connection status and sync history
export async function GET() {
  try {
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
        scopes: process.env.X_SCOPES || "tweet.read users.read offline.access",
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
