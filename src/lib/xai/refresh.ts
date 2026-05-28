import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import { deleteXaiAuth, findXaiAuth, upsertXaiAuth } from "@/lib/xai/authStore";
import { getXaiTokenEncryptionKey, refreshXaiToken } from "@/lib/xai/oauth";

export type XaiRefreshResult =
  | { ok: true; expiresAt: string | null; rotated: boolean }
  | { ok: false; reason: string };

/**
 * Proactively refreshes the stored xAI OAuth token to keep the refresh_token
 * chain "warm" — xAI may invalidate refresh_tokens after inactivity.
 *
 * On 401 / invalid_client / invalid_grant, the stale tokens are deleted from DB
 * so the UI shows the "reconnect" state.
 *
 * Safe to call when no token is stored; returns `{ ok: false, reason: ... }`.
 */
export async function refreshStoredXaiTokens(): Promise<XaiRefreshResult> {
  if (!process.env.XAI_CLIENT_ID) {
    return { ok: false, reason: "XAI_CLIENT_ID not set" };
  }

  const oauth = await findXaiAuth();
  if (!oauth?.refreshToken) {
    return { ok: false, reason: "no refresh token stored" };
  }

  const encryptionKey = getXaiTokenEncryptionKey();
  if (!encryptionKey) {
    return { ok: false, reason: "encryption key not configured" };
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

    return {
      ok: true,
      expiresAt: refreshed.expiresAt?.toISOString() ?? null,
      rotated: Boolean(refreshed.refreshToken),
    };
  } catch (refreshErr) {
    const msg = refreshErr instanceof Error ? refreshErr.message : "";
    if (
      msg.includes("401") ||
      msg.includes("invalid_client") ||
      msg.includes("invalid_grant")
    ) {
      console.warn("[xai/refresh] refresh token rejected — deleting stale auth", msg);
      await deleteXaiAuth().catch(() => {});
      return { ok: false, reason: "refresh token expired, re-auth required" };
    }
    throw refreshErr;
  }
}
