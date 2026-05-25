import { prisma } from "@/lib/db/prisma";
import { encryptToken } from "@/lib/x/tokenStore";
import {
  getXaiTokenEncryptionKey,
  type XaiPkceSession,
  type XaiTokenResult,
  XAI_OAUTH_ID,
} from "@/lib/xai/oauth";

const XAI_OAUTH_SESSION_KEY = "xai_oauth_session";

export interface StoredXaiAuth {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string;
  updatedAt: Date;
}

export async function findXaiAuth(): Promise<StoredXaiAuth | null> {
  const rows = await prisma.$queryRaw<StoredXaiAuth[]>`
    SELECT
      "id",
      "accessToken",
      "refreshToken",
      "expiresAt",
      "scope",
      "updatedAt"
    FROM "XAuth"
    WHERE "id" = ${XAI_OAUTH_ID}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function upsertXaiAuth(data: {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string;
}): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "XAuth" (
      "id",
      "accessToken",
      "refreshToken",
      "expiresAt",
      "scope",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${XAI_OAUTH_ID},
      ${data.accessToken},
      ${data.refreshToken},
      ${data.expiresAt},
      ${data.scope},
      NOW(),
      NOW()
    )
    ON CONFLICT ("id") DO UPDATE SET
      "accessToken" = EXCLUDED."accessToken",
      "refreshToken" = EXCLUDED."refreshToken",
      "expiresAt" = EXCLUDED."expiresAt",
      "scope" = EXCLUDED."scope",
      "updatedAt" = NOW()
  `;
}

export async function saveXaiTokens(tokens: XaiTokenResult): Promise<void> {
  const encryptionKey = getXaiTokenEncryptionKey();
  if (!encryptionKey) throw new Error("XAI_ENCRYPTION_KEY is not set");

  await upsertXaiAuth({
    accessToken: encryptToken(tokens.accessToken, encryptionKey),
    refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken, encryptionKey) : null,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
  });
}

export async function deleteXaiAuth(): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "XAuth"
    WHERE "id" = ${XAI_OAUTH_ID}
  `;
}

export async function saveXaiOAuthSession(session: XaiPkceSession): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: XAI_OAUTH_SESSION_KEY },
    create: {
      key: XAI_OAUTH_SESSION_KEY,
      valueJson: JSON.stringify({
        ...session,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }),
    },
    update: {
      valueJson: JSON.stringify({
        ...session,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }),
    },
  });
}

export async function findXaiOAuthSession(
  state: string
): Promise<XaiPkceSession | null> {
  const stored = await prisma.appSetting.findUnique({
    where: { key: XAI_OAUTH_SESSION_KEY },
  });

  if (!stored?.valueJson) return null;

  try {
    const value = JSON.parse(stored.valueJson) as XaiPkceSession & {
      expiresAt?: string;
    };
    if (value.state !== state) return null;
    if (!value.expiresAt || new Date(value.expiresAt).getTime() < Date.now()) {
      return null;
    }
    return {
      state: value.state,
      nonce: value.nonce,
      codeVerifier: value.codeVerifier,
      codeChallenge: value.codeChallenge,
    };
  } catch {
    return null;
  }
}

export async function clearXaiOAuthSession(): Promise<void> {
  await prisma.appSetting.deleteMany({
    where: { key: XAI_OAUTH_SESSION_KEY },
  });
}
