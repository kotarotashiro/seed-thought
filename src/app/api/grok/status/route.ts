import { NextResponse } from "next/server";
import { findXaiAuth } from "@/lib/xai/authStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await findXaiAuth();

    return NextResponse.json({
      connected: Boolean(auth),
      auth: auth
        ? {
            id: auth.id,
            expiresAt: auth.expiresAt,
            scope: auth.scope,
            updatedAt: auth.updatedAt,
          }
        : null,
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
