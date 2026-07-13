// Grok OAuth ワンコマンド再接続スクリプト
// =============================================================================
// xAI のサブスク OAuth は「ローカルの 127.0.0.1:56121 でコールバックを受ける」
// 方式しか許されていない（共有クライアント＋ループバック固定）。このスクリプトは
// その一瞬のループバック認証だけをローカルで行い、得られたトークンを本番アプリの
// /api/grok/token に送って本番DBへ保存する。
//
// 使い方:
//   1) リポジトリ直下の .env に以下を設定（初回のみ）:
//        XAI_CLIENT_ID=...            （既にあるはず・公開値）
//        APP_BASE_URL=https://<本番ドメイン>
//        CRON_SECRET=...              （本番と同じ値）
//   2) `pnpm grok:auth` を実行、またはリポジトリ直下の grok-reconnect.cmd をダブルクリック
//   3) 開いたブラウザで「承認」を押すだけ
//
// APP_BASE_URL を省略するとローカル(http://localhost:3000)へ送る（dev 用）。
// =============================================================================

import "dotenv/config";
import crypto from "node:crypto";
import http from "node:http";
import { exec } from "node:child_process";

const ISSUER = "https://auth.x.ai";
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
const REDIRECT_URI = "http://127.0.0.1:56121/callback";
const CALLBACK_PORT = 56121;
const SCOPE = "openid profile email offline_access grok-cli:access api:access";

function base64Url(buf) {
  return buf.toString("base64url");
}

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === "win32") {
    // start の第1引数はウィンドウタイトル扱いなので空文字を渡す
    cmd = `start "" "${url}"`;
  } else if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log("\nブラウザを自動で開けませんでした。以下のURLを手動で開いてください:\n");
      console.log(url + "\n");
    }
  });
}

async function getDiscovery() {
  const res = await fetch(DISCOVERY_URL, { cache: "no-store" });
  if (!res.ok) fail(`xAI OAuth discovery に失敗: ${res.status}`);
  const data = await res.json();
  if (!data.authorization_endpoint || !data.token_endpoint) {
    fail("xAI OAuth discovery のレスポンスにエンドポイントがありません");
  }
  return data;
}

async function exchangeCode(tokenEndpoint, clientId, code, codeVerifier, codeChallenge) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    client_id: clientId,
  });
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    fail(`トークン交換に失敗: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.access_token) fail("レスポンスに access_token がありません");
  const expiresIn =
    typeof data.expires_in === "number"
      ? data.expires_in
      : typeof data.expires_in === "string" && data.expires_in.trim() !== ""
        ? Number(data.expires_in)
        : null;
  const validExpiresIn =
    typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0
      ? expiresIn
      : null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: validExpiresIn
      ? new Date(Date.now() + validExpiresIn * 1000).toISOString()
      : null,
    scope: data.scope ?? SCOPE,
  };
}

async function pushTokens(baseUrl, secret, clientId, tokens) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/grok/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ clientId, ...tokens }),
  });
  if (!res.ok) {
    const text = await res.text();
    fail(`本番へのトークン送信に失敗: ${res.status} ${text.slice(0, 200)}`);
  }
}

async function main() {
  const clientId = process.env.XAI_CLIENT_ID?.trim();
  if (!clientId) fail("XAI_CLIENT_ID が未設定です（.env に追加してください）");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clientId
    )
  ) {
    fail("XAI_CLIENT_ID は改行を含まないUUID形式で設定してください");
  }

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const secret = process.env.CRON_SECRET;
  if (!secret) fail("CRON_SECRET が未設定です（.env に本番と同じ値を追加してください）");

  console.log(`\n🔗 トークン送信先: ${baseUrl}\n`);

  const discovery = await getDiscovery();

  // PKCE
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");

  const authorizeUrl =
    `${discovery.authorization_endpoint}?` +
    new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();

  // 一瞬だけループバックサーバを立ててコールバックを待つ
  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${CALLBACK_PORT}`);
        if (url.pathname !== "/callback") {
          res.writeHead(404).end("Not found");
          return;
        }

        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h2>認証がキャンセルされました。ターミナルに戻ってください。</h2>");
          fail(`認証がキャンセルされました: ${error}`);
          return;
        }
        if (!code || returnedState !== state) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h2>コールバックの検証に失敗しました。</h2>");
          fail("コールバックの state 検証に失敗しました");
          return;
        }

        const tokens = await exchangeCode(
          discovery.token_endpoint,
          clientId,
          code,
          codeVerifier,
          codeChallenge
        );
        await pushTokens(baseUrl, secret, clientId, tokens);

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h2>✅ Grok再接続が完了しました。</h2><p>このタブを閉じてください。</p>"
        );
        console.log("\n✅ Grok再接続が完了しました。トークンを本番に保存しました。\n");
        server.close();
        process.exit(0);
      } catch (err) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>エラーが発生しました。ターミナルを確認してください。</h2>");
        fail(err instanceof Error ? err.message : String(err));
      }
    })();
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      fail(`ポート ${CALLBACK_PORT} が使用中です。dev サーバを止めてから再実行してください。`);
    }
    fail(err.message);
  });

  server.listen(CALLBACK_PORT, "127.0.0.1", () => {
    console.log("ブラウザを開いて「承認」を押してください…\n");
    openBrowser(authorizeUrl);
  });
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
