import { NextResponse } from "next/server";
import { getUserFacingError } from "@/lib/api/errors";
import {
  clearXaiOAuthSession,
  findXaiOAuthSession,
  saveXaiTokens,
} from "@/lib/xai/authStore";
import { exchangeXaiCodeForTokens } from "@/lib/xai/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const settingsUrl = new URL("/settings/x", request.url);

  if (!code || !state) {
    settingsUrl.searchParams.set("error", "Grok OAuthコールバックパラメータが不足しています");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const session = await findXaiOAuthSession(state);
    if (!session) {
      settingsUrl.searchParams.set("error", "Grok OAuth認証フローが期限切れです。もう一度お試しください。");
      return NextResponse.redirect(settingsUrl);
    }

    const tokens = await exchangeXaiCodeForTokens(code, session);
    await saveXaiTokens(tokens);
    await clearXaiOAuthSession();

    settingsUrl.searchParams.set("grok", "connected");
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error("[grok/callback]", error);
    settingsUrl.searchParams.set(
      "error",
      getUserFacingError(error, "Grok OAuth連携に失敗しました")
    );
    return NextResponse.redirect(settingsUrl);
  }
}
