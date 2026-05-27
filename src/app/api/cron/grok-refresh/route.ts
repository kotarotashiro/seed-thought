import { NextResponse } from "next/server";
import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import { deleteXaiAuth, findXaiAuth, upsertXaiAuth } from "@/lib/xai/authStore";
import { getXaiTokenEncryptionKey, refreshXaiToken } from "@/lib/xai/oauth";

// Vercel Cron: refreshes Grok OAuth tokens proactively to keep the refresh_token
// chain "warm" — xAI may invalidate refresh_tokens after inactivity.
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
    if (!process.env.XAI_CLIENT_ID) {
      return NextResponse.json({ ok: false, reason: "XAI_CLIENT_ID not set" });
    }

    const oauth = await findXaiAuth();
    if (!oauth?.refreshToken) {
      return NextResponse.json({ ok: false, reason: "no refresh token stored" });
    }

    const encryptionKey = getXaiTokenEncryptionKey();
    if (!encryptionKey) {
      return NextResponse.json(
        { ok: false, reason: "encryption key not configured" },
        { status: 500 }
      );
    }

    try {
      const refreshed = await refreshXaiToken(decryptToken(oauth.refreshToken, encryptionKey));
      await upsertXaiAuth({
        accessToken: encryptToken(refreshed.accessToken, encryptionKey),
        refreshToken: refreshed.refreshToken
          ? encryptToken(refreshed.refreshToken, encryptionKey)
          : oauth.refreshToken,
        expiresAt: refreshed.expiresAt,
        scope: refreshed.scope,
      });

      console.log("[cron/grok-refresh] refreshed successfully", {
        expiresAt: refreshed.expiresAt?.toISOString(),
        rotated: Boolean(refreshed.refreshToken),
      });

      return NextResponse.json({
        ok: true,
        expiresAt: refreshed.expiresAt?.toISOString() ?? null,
        rotated: Boolean(refreshed.refreshToken),
      });
    } catch (refreshErr) {
      const msg = refreshErr instanceof Error ? refreshErr.message : "";
      if (
        msg.includes("401") ||
        msg.includes("invalid_client") ||
        msg.includes("invalid_grant")
      ) {
        console.warn("[cron/grok-refresh] refresh token rejected — deleting stale auth", msg);
        await deleteXaiAuth().catch(() => {});
        return NextResponse.json(
          { ok: false, reason: "refresh token expired, re-auth required" },
          { status: 200 }
        );
      }
      throw refreshErr;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "refresh failed";
    console.error("[cron/grok-refresh]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
