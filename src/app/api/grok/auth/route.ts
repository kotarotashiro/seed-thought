import http from "http";
import { NextResponse } from "next/server";
import { getUserFacingError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import {
  buildXaiAuthorizeUrl,
  createXaiPkceSession,
  exchangeXaiCodeForTokens,
  getXaiTokenEncryptionKey,
  XAI_OAUTH_ID,
} from "@/lib/xai/oauth";
import { encryptToken } from "@/lib/x/tokenStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_PORT = 56121;
const CALLBACK_PATH = "/callback";

let activeServer: http.Server | null = null;

function closeActiveServer() {
  if (!activeServer) return;
  activeServer.close();
  activeServer = null;
}

function htmlRedirect(location: string, message: string): string {
  const safeLocation = location.replace(/"/g, "&quot;");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safeLocation}"></head><body><p>${message}</p><script>location.replace("${safeLocation}")</script></body></html>`;
}

async function storeTokens(
  tokens: Awaited<ReturnType<typeof exchangeXaiCodeForTokens>>
) {
  const encryptionKey = getXaiTokenEncryptionKey();
  if (!encryptionKey) throw new Error("XAI_ENCRYPTION_KEY is not set");

  await prisma.xAuth.upsert({
    where: { id: XAI_OAUTH_ID },
    create: {
      id: XAI_OAUTH_ID,
      accessToken: encryptToken(tokens.accessToken, encryptionKey),
      refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken, encryptionKey) : null,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
    update: {
      accessToken: encryptToken(tokens.accessToken, encryptionKey),
      refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken, encryptionKey) : undefined,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
  });
}

async function startLoopbackServer(options: {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  settingsUrl: string;
}): Promise<void> {
  closeActiveServer();

  activeServer = http.createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", `http://${CALLBACK_HOST}:${CALLBACK_PORT}`);
        const settingsUrl = new URL(options.settingsUrl);

        if (url.pathname !== CALLBACK_PATH) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }

        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (error) {
          settingsUrl.searchParams.set("error", "Grok OAuth認証がキャンセルされました");
          res.writeHead(302, { Location: settingsUrl.toString() });
          res.end();
          return;
        }

        if (!code || state !== options.state) {
          settingsUrl.searchParams.set("error", "Grok OAuthコールバックの検証に失敗しました");
          res.writeHead(302, { Location: settingsUrl.toString() });
          res.end();
          return;
        }

        const tokens = await exchangeXaiCodeForTokens(code, {
          codeVerifier: options.codeVerifier,
          codeChallenge: options.codeChallenge,
        });
        await storeTokens(tokens);

        settingsUrl.searchParams.set("grok", "connected");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlRedirect(settingsUrl.toString(), "Grok OAuth連携が完了しました。"));
      } catch (error) {
        console.error("[grok/auth callback]", error);
        const settingsUrl = new URL(options.settingsUrl);
        settingsUrl.searchParams.set(
          "error",
          getUserFacingError(error, "Grok OAuth連携に失敗しました")
        );
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlRedirect(settingsUrl.toString(), "Grok OAuth連携に失敗しました。"));
      } finally {
        closeActiveServer();
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    activeServer?.once("error", reject);
    activeServer?.listen(CALLBACK_PORT, CALLBACK_HOST, () => resolve());
  });
}

export async function GET(request: Request) {
  try {
    if (!process.env.XAI_CLIENT_ID) {
      return NextResponse.json(
        { error: "XAI_CLIENT_IDが未設定です。GROK_API_KEYフォールバックを使用します。" },
        { status: 400 }
      );
    }

    const session = createXaiPkceSession();
    const settingsUrl = new URL("/settings/x", request.url).toString();

    await startLoopbackServer({ ...session, settingsUrl });
    const authorizeUrl = await buildXaiAuthorizeUrl(session);
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error("[grok/auth]", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "Grok OAuth認証URLの生成に失敗しました。") },
      { status: 500 }
    );
  }
}
