import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { encryptToken } from "@/lib/x/tokenStore";
import {
  getXaiTokenEncryptionKey,
  type XaiPkceSession,
  type XaiTokenResult,
  XAI_OAUTH_ID,
} from "@/lib/xai/oauth";

const XAI_OAUTH_SESSION_KEY = "xai_oauth_session";
const LOCAL_AUTH_FILE = ".xai-auth.local.json";

export interface StoredXaiAuth {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string;
  updatedAt: Date;
}

interface StoredXaiAuthJson extends Omit<StoredXaiAuth, "expiresAt" | "updatedAt"> {
  expiresAt: string | null;
  updatedAt: string;
}

interface LocalAuthFile {
  auth?: StoredXaiAuthJson | null;
  oauthSession?: (XaiPkceSession & { expiresAt: string }) | null;
}

function localFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.XAI_LOCAL_AUTH_FALLBACK === "1";
}

function localAuthPath(): string {
  return path.join(process.cwd(), LOCAL_AUTH_FILE);
}

function toJsonAuth(auth: StoredXaiAuth): StoredXaiAuthJson {
  return {
    ...auth,
    expiresAt: auth.expiresAt?.toISOString() ?? null,
    updatedAt: auth.updatedAt.toISOString(),
  };
}

function fromJsonAuth(auth: StoredXaiAuthJson): StoredXaiAuth {
  return {
    ...auth,
    expiresAt: auth.expiresAt ? new Date(auth.expiresAt) : null,
    updatedAt: new Date(auth.updatedAt),
  };
}

async function readLocalFile(): Promise<LocalAuthFile> {
  if (!localFallbackEnabled()) return {};
  try {
    return JSON.parse(await fs.readFile(localAuthPath(), "utf8")) as LocalAuthFile;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return {};
    throw error;
  }
}

async function writeLocalFile(data: LocalAuthFile): Promise<void> {
  if (!localFallbackEnabled()) return;
  await fs.writeFile(localAuthPath(), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function warnLocalFallback(operation: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[xai/authStore] ${operation} failed; using local dev fallback: ${message}`);
}

async function findLocalXaiAuth(): Promise<StoredXaiAuth | null> {
  const data = await readLocalFile();
  return data.auth ? fromJsonAuth(data.auth) : null;
}

async function upsertLocalXaiAuth(data: {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string;
}): Promise<void> {
  const current = await readLocalFile();
  current.auth = toJsonAuth({
    id: XAI_OAUTH_ID,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    scope: data.scope,
    updatedAt: new Date(),
  });
  await writeLocalFile(current);
}

export async function findXaiAuth(): Promise<StoredXaiAuth | null> {
  try {
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

    return rows[0] ?? (await findLocalXaiAuth());
  } catch (error) {
    if (!localFallbackEnabled()) throw error;
    warnLocalFallback("findXaiAuth", error);
    return findLocalXaiAuth();
  }
}

export async function upsertXaiAuth(data: {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string;
}): Promise<void> {
  try {
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
  } catch (error) {
    if (!localFallbackEnabled()) throw error;
    warnLocalFallback("upsertXaiAuth", error);
    await upsertLocalXaiAuth(data);
  }
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
  try {
    await prisma.$executeRaw`
      DELETE FROM "XAuth"
      WHERE "id" = ${XAI_OAUTH_ID}
    `;
  } catch (error) {
    if (!localFallbackEnabled()) throw error;
    warnLocalFallback("deleteXaiAuth", error);
  }

  if (localFallbackEnabled()) {
    const current = await readLocalFile();
    current.auth = null;
    await writeLocalFile(current);
  }
}

export async function saveXaiOAuthSession(session: XaiPkceSession): Promise<void> {
  const value = {
    ...session,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };

  try {
    await prisma.appSetting.upsert({
      where: { key: XAI_OAUTH_SESSION_KEY },
      create: {
        key: XAI_OAUTH_SESSION_KEY,
        valueJson: JSON.stringify(value),
      },
      update: {
        valueJson: JSON.stringify(value),
      },
    });
  } catch (error) {
    if (!localFallbackEnabled()) throw error;
    warnLocalFallback("saveXaiOAuthSession", error);
    const current = await readLocalFile();
    current.oauthSession = value;
    await writeLocalFile(current);
  }
}

export async function findXaiOAuthSession(
  state: string
): Promise<XaiPkceSession | null> {
  let valueJson: string | null | undefined;
  try {
    const stored = await prisma.appSetting.findUnique({
      where: { key: XAI_OAUTH_SESSION_KEY },
    });
    valueJson = stored?.valueJson;
  } catch (error) {
    if (!localFallbackEnabled()) throw error;
    warnLocalFallback("findXaiOAuthSession", error);
    const local = await readLocalFile();
    valueJson = local.oauthSession ? JSON.stringify(local.oauthSession) : null;
  }

  if (!valueJson) return null;

  try {
    const value = JSON.parse(valueJson) as XaiPkceSession & {
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
  try {
    await prisma.appSetting.deleteMany({
      where: { key: XAI_OAUTH_SESSION_KEY },
    });
  } catch (error) {
    if (!localFallbackEnabled()) throw error;
    warnLocalFallback("clearXaiOAuthSession", error);
  }

  if (localFallbackEnabled()) {
    const current = await readLocalFile();
    current.oauthSession = null;
    await writeLocalFile(current);
  }
}
