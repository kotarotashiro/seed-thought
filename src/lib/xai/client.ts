// xAI client — OAuth bearer preferred, API key fallback.

import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import { deleteXaiAuth, findXaiAuth, upsertXaiAuth } from "@/lib/xai/authStore";
import {
  getXaiTokenEncryptionKey,
  refreshXaiToken,
  XaiTokenExpiredError,
} from "@/lib/xai/oauth";

const XAI_API_BASE = "https://api.x.ai/v1";

export type XaiTool =
  | { type: "web_search" | "code_interpreter" }
  | {
      type: "x_search";
      /** 指定ハンドルの投稿のみを対象にする（最大20件）。excluded とは併用不可。 */
      allowed_x_handles?: string[];
      /** 指定ハンドルの投稿を除外する（最大20件）。allowed とは併用不可。 */
      excluded_x_handles?: string[];
      /** ISO8601 (YYYY-MM-DD) 期間の下限 */
      from_date?: string;
      /** ISO8601 (YYYY-MM-DD) 期間の上限 */
      to_date?: string;
      enable_image_understanding?: boolean;
      enable_video_understanding?: boolean;
    };

export interface XaiChatOptions {
  model?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  tools?: XaiTool[];
  temperature?: number;
  /** Hint to return JSON. Handled via prompting — Responses API doesn't have a json_object mode. */
  jsonMode?: boolean;
}

export interface XaiChatResult {
  content: string;
}

export interface XaiImagineOptions {
  prompt: string;
  n?: number;
}

export interface XaiImagineResult {
  imageUrl?: string;
  dataBase64?: string;
  mimeType?: string;
}

/**
 * Attempts to resolve a valid xAI access token via OAuth.
 * Returns the raw (decrypted) access token on success.
 * Returns null when OAuth is not configured, not connected, or the refresh
 * token has expired (stale tokens are deleted as a side effect — caller
 * should fall back to the API key).
 * Throws on non-auth errors (network, encryption issues, etc.).
 */
async function tryGetOAuthToken(): Promise<string | null> {
  if (!process.env.XAI_CLIENT_ID) return null;

  const oauth = await findXaiAuth();
  if (!oauth?.accessToken) return null;

  const encryptionKey = getXaiTokenEncryptionKey();
  if (!encryptionKey) throw new Error("XAI_ENCRYPTION_KEY is not set");

  // 期限の10分前から先行リフレッシュしてトークンチェーンを温め続ける
  // （xAIは無活動でrefresh_tokenを失効させるため、利用のたびに更新しておく）。
  const expiresAt = oauth.expiresAt?.getTime() ?? 0;
  const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 10 * 60_000;

  if (shouldRefresh && oauth.refreshToken) {
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
      return refreshed.accessToken;
    } catch (refreshErr) {
      // 401 / invalid_client / invalid_grant = refresh token itself is dead.
      // Delete stale tokens, then signal the caller to try the API key fallback.
      const msg = refreshErr instanceof Error ? refreshErr.message : "";
      if (msg.includes("401") || msg.includes("invalid_client") || msg.includes("invalid_grant")) {
        console.warn("[xai/client] refresh token expired — deleting stale auth, trying API key fallback");
        await deleteXaiAuth().catch(() => {});
        return null;
      }
      throw refreshErr;
    }
  }

  return decryptToken(oauth.accessToken, encryptionKey);
}

export async function getAuthHeader(): Promise<string> {
  const oauthToken = await tryGetOAuthToken();
  if (oauthToken !== null) {
    return `Bearer ${oauthToken}`;
  }

  // OAuth not configured, not connected, or token expired — try API key fallback.
  const apiKey = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
  if (apiKey) return `Bearer ${apiKey}`;

  // Nothing available at all.
  if (process.env.XAI_CLIENT_ID) {
    // OAuth was expected but is expired/missing, and no API key is configured.
    throw new XaiTokenExpiredError();
  }
  throw new Error("Grok認証が未設定です");
}

export async function hasXaiAuthConfigured(): Promise<boolean> {
  if (process.env.GROK_API_KEY ?? process.env.XAI_API_KEY) return true;
  if (!process.env.XAI_CLIENT_ID) return false;

  return Boolean(await findXaiAuth());
}

function getDefaultModel(): string {
  return process.env.GROK_MODEL ?? process.env.XAI_MODEL ?? "grok-4.3";
}

function extractContent(data: unknown): string {
  const d = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  if (d.output_text) return d.output_text;
  if (Array.isArray(d.output)) {
    return d.output
      .flatMap((block) => block.content ?? [])
      .map((c) => c.text ?? "")
      .join("");
  }
  return "";
}

export async function xaiChat(options: XaiChatOptions): Promise<XaiChatResult> {
  const inputMessages = options.jsonMode
    ? [
        {
          role: "system" as const,
          content:
            "Respond with valid JSON only. No markdown code fences. No explanatory text before or after the JSON object.",
        },
        ...options.messages,
      ]
    : options.messages;

  const body: Record<string, unknown> = {
    model: options.model ?? getDefaultModel(),
    input: inputMessages,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }
  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  const res = await fetch(`${XAI_API_BASE}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: await getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return { content: extractContent(data) };
}

export async function xaiSearchX(query: string): Promise<XaiChatResult> {
  return xaiChat({
    messages: [{ role: "user", content: query }],
    tools: [{ type: "x_search" }],
  });
}

export async function xaiSearchWeb(query: string): Promise<XaiChatResult> {
  return xaiChat({
    messages: [{ role: "user", content: query }],
    tools: [{ type: "web_search" }],
  });
}

export async function xaiImagine(_options: XaiImagineOptions): Promise<XaiImagineResult> {
  throw new Error("xaiImagine not yet implemented — implement in Phase 5 with OAuth");
}
