import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import {
  deleteXaiAuth,
  findXaiAuth,
  upsertXaiAuth,
  type StoredXaiAuth,
} from "@/lib/xai/authStore";
import {
  getXaiTokenEncryptionKey,
  isTerminalXaiRefreshError,
  refreshXaiToken,
} from "@/lib/xai/oauth";

export type XaiRefreshResult =
  | { ok: true; expiresAt: string | null; rotated: boolean }
  | {
      ok: false;
      code: "not_due" | "reauth_required" | "misconfigured" | "concurrent_refresh";
      reason: string;
    };

export interface XaiAccessTokenResult {
  token: string;
  storedAccessToken: string;
  expiresAt: Date | null;
  refreshed: boolean;
  rotated: boolean;
}

/** GitHub Actionsの遅延を吸収するため、6時間tokenは期限の4時間前から更新する。 */
export const ACCESS_TOKEN_REFRESH_WINDOW_MS = 4 * 60 * 60 * 1000;
/** expiresAt が取れない応答でも、2時間以上同じアクセストークンを使わない。 */
export const UNKNOWN_EXPIRY_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;

let refreshInFlight: Promise<XaiAccessTokenResult | null> | null = null;

export function isXaiAccessTokenRefreshDue(
  auth: Pick<StoredXaiAuth, "expiresAt" | "updatedAt">,
  now = Date.now()
): boolean {
  const expiresAt = auth.expiresAt?.getTime() ?? Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    return expiresAt - now <= ACCESS_TOKEN_REFRESH_WINDOW_MS;
  }

  const updatedAt = auth.updatedAt?.getTime() ?? Number.NaN;
  return !Number.isFinite(updatedAt) || now - updatedAt >= UNKNOWN_EXPIRY_REFRESH_INTERVAL_MS;
}

function toAccessTokenResult(
  auth: StoredXaiAuth,
  encryptionKey: string,
  refreshed: boolean,
  rotated = false
): XaiAccessTokenResult {
  return {
    token: decryptToken(auth.accessToken, encryptionKey),
    storedAccessToken: auth.accessToken,
    expiresAt: auth.expiresAt,
    refreshed,
    rotated,
  };
}

function authChangedSince(current: StoredXaiAuth, latest: StoredXaiAuth): boolean {
  const currentUpdatedAt = current.updatedAt?.getTime() ?? Number.NaN;
  const latestUpdatedAt = latest.updatedAt?.getTime() ?? Number.NaN;

  return (
    latest.accessToken !== current.accessToken ||
    latest.refreshToken !== current.refreshToken ||
    (Number.isFinite(currentUpdatedAt) &&
      Number.isFinite(latestUpdatedAt) &&
      latestUpdatedAt > currentUpdatedAt)
  );
}

async function performXaiTokenRefresh(options: {
  force: boolean;
  expectedStoredAccessToken?: string;
}): Promise<XaiAccessTokenResult | null> {
  const oauth = await findXaiAuth();
  if (!oauth?.accessToken) return null;

  const encryptionKey = getXaiTokenEncryptionKey();
  if (!encryptionKey) throw new Error("XAI_ENCRYPTION_KEY is not set");

  // 別のServerless実行環境が先に更新していたら、同じrefresh tokenを再消費しない。
  if (
    options.expectedStoredAccessToken &&
    oauth.accessToken !== options.expectedStoredAccessToken
  ) {
    return toAccessTokenResult(oauth, encryptionKey, false);
  }

  if (!options.force && !isXaiAccessTokenRefreshDue(oauth)) {
    return toAccessTokenResult(oauth, encryptionKey, false);
  }

  if (!oauth.refreshToken) return null;

  const currentRefreshToken = oauth.refreshToken;
  try {
    const refreshed = await refreshXaiToken(decryptToken(currentRefreshToken, encryptionKey));
    const storedAccessToken = encryptToken(refreshed.accessToken, encryptionKey);
    await upsertXaiAuth({
      accessToken: storedAccessToken,
      refreshToken: refreshed.refreshToken
        ? encryptToken(refreshed.refreshToken, encryptionKey)
        : currentRefreshToken,
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope,
    });

    return {
      token: refreshed.accessToken,
      storedAccessToken,
      expiresAt: refreshed.expiresAt,
      refreshed: true,
      rotated: Boolean(refreshed.refreshToken),
    };
  } catch (refreshErr) {
    if (!isTerminalXaiRefreshError(refreshErr)) throw refreshErr;

    // refresh token rotationの競合では、後勝ち側がすでにDBへ保存済み。
    // その場合に古いトークンを削除すると、正常な接続まで切断してしまう。
    let latest: StoredXaiAuth | null;
    try {
      latest = await findXaiAuth();
    } catch {
      // DB障害時に認証情報を消すのは危険なので、元のエラーを維持する。
      throw refreshErr;
    }
    if (latest && authChangedSince(oauth, latest)) {
      return toAccessTokenResult(latest, encryptionKey, false);
    }

    const message = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
    console.warn("[xai/refresh] refresh token invalid — deleting stale auth", message);
    await deleteXaiAuth().catch(() => {});
    return null;
  }
}

/**
 * OAuthアクセストークンを取得する。期限が近い場合はrefreshし、同一プロセス内の
 * 同時リクエストは1本のrefresh処理を共有する。forceはAPIから401を受けた時だけ使う。
 */
export async function getXaiAccessToken(options: {
  force?: boolean;
  expectedStoredAccessToken?: string;
} = {}): Promise<XaiAccessTokenResult | null> {
  if (!process.env.XAI_CLIENT_ID?.trim()) return null;

  if (refreshInFlight) return refreshInFlight;

  const oauth = await findXaiAuth();
  if (!oauth?.accessToken) return null;

  const force = options.force === true;
  if (!force && !isXaiAccessTokenRefreshDue(oauth)) {
    const encryptionKey = getXaiTokenEncryptionKey();
    if (!encryptionKey) throw new Error("XAI_ENCRYPTION_KEY is not set");
    return toAccessTokenResult(oauth, encryptionKey, false);
  }

  if (!oauth.refreshToken) return null;

  const task = performXaiTokenRefresh({
    force,
    expectedStoredAccessToken: options.expectedStoredAccessToken ?? oauth.accessToken,
  });
  refreshInFlight = task;
  try {
    return await task;
  } finally {
    if (refreshInFlight === task) refreshInFlight = null;
  }
}

/**
 * Cronや手動heartbeatから呼ぶ更新処理。必要な時だけ更新し、refresh tokenの競合で
 * 正常なDBレコードを削除しない。
 */
export async function refreshStoredXaiTokens(options: {
  force?: boolean;
} = {}): Promise<XaiRefreshResult> {
  if (!process.env.XAI_CLIENT_ID?.trim()) {
    return { ok: false, code: "misconfigured", reason: "XAI_CLIENT_ID not set" };
  }

  const oauth = await findXaiAuth();
  if (!oauth?.refreshToken) {
    return { ok: false, code: "reauth_required", reason: "no refresh token stored" };
  }
  if (!options.force && !isXaiAccessTokenRefreshDue(oauth)) {
    return { ok: false, code: "not_due", reason: "token not due for refresh, skip" };
  }

  const result = await getXaiAccessToken({
    force: options.force,
    expectedStoredAccessToken: oauth.accessToken,
  });
  if (!result) {
    return {
      ok: false,
      code: "reauth_required",
      reason: "refresh token expired, re-auth required",
    };
  }
  if (!result.refreshed) {
    return {
      ok: false,
      code: "concurrent_refresh",
      reason: "token was refreshed by another request, skip",
    };
  }

  return {
    ok: true,
    expiresAt: result.expiresAt?.toISOString() ?? null,
    rotated: result.rotated,
  };
}
