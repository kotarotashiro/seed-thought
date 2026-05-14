import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/x/oauth";
import { fetchAuthenticatedUser } from "@/lib/x/client";
import { encryptToken } from "@/lib/x/tokenStore";
import { getUserFacingError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/x?error=${encodeURIComponent("X認証がキャンセルされました")}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/settings/x?error=${encodeURIComponent("不正なコールバックパラメータです")}`, request.url)
    );
  }

  try {
    const cookieStore = await cookies();
    const savedState = cookieStore.get("x_oauth_state")?.value;
    const codeVerifier = cookieStore.get("x_oauth_code_verifier")?.value;

    if (!savedState || state !== savedState) {
      return NextResponse.redirect(
        new URL(`/settings/x?error=${encodeURIComponent("CSRF検証に失敗しました")}`, request.url)
      );
    }

    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL(`/settings/x?error=${encodeURIComponent("認証フローが期限切れです。もう一度お試しください。")}`, request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    // Get user info
    const user = await fetchAuthenticatedUser(tokens.accessToken);

    // Store or update the account
    await prisma.xAccount.upsert({
      where: { xUserId: user.id },
      create: {
        xUserId: user.id,
        username: user.username,
        displayName: user.name,
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        scopesJson: JSON.stringify(tokens.scope.split(" ")),
      },
      update: {
        username: user.username,
        displayName: user.name,
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        scopesJson: JSON.stringify(tokens.scope.split(" ")),
      },
    });

    // Clear cookies
    cookieStore.delete("x_oauth_state");
    cookieStore.delete("x_oauth_code_verifier");

    return NextResponse.redirect(
      new URL("/settings/x?success=true", request.url)
    );
  } catch (err) {
    console.error("X OAuth callback error:", err);
    const errorMsg = getUserFacingError(err, "認証に失敗しました");
    return NextResponse.redirect(
      new URL(`/settings/x?error=${encodeURIComponent(errorMsg)}`, request.url)
    );
  }
}
