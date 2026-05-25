import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { XAI_OAUTH_ID } from "@/lib/xai/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await prisma.xAuth.findUnique({
      where: { id: XAI_OAUTH_ID },
      select: {
        id: true,
        expiresAt: true,
        scope: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      connected: Boolean(auth),
      auth,
      config: {
        clientIdConfigured: Boolean(process.env.XAI_CLIENT_ID),
        tokenEncryptionConfigured: Boolean(
          process.env.XAI_ENCRYPTION_KEY ?? process.env.TOKEN_ENCRYPTION_KEY
        ),
        apiKeyFallbackConfigured: Boolean(process.env.GROK_API_KEY ?? process.env.XAI_API_KEY),
      },
    });
  } catch (error) {
    console.error("[grok/status]", error);
    return NextResponse.json({ error: "Grok接続状態の取得に失敗しました" }, { status: 500 });
  }
}
