// xAI client — OAuth bearer preferred, API key fallback.

import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import { findXaiAuth, upsertXaiAuth } from "@/lib/xai/authStore";
import {
  getXaiTokenEncryptionKey,
  refreshXaiToken,
} from "@/lib/xai/oauth";

const XAI_API_BASE = "https://api.x.ai/v1";

export type XaiTool = { type: "web_search" | "x_search" | "code_interpreter" };

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

export async function getAuthHeader(): Promise<string> {
  if (process.env.XAI_CLIENT_ID) {
    const oauth = await findXaiAuth();

    if (oauth?.accessToken) {
      const encryptionKey = getXaiTokenEncryptionKey();
      if (!encryptionKey) throw new Error("XAI_ENCRYPTION_KEY is not set");

      const expiresAt = oauth.expiresAt?.getTime() ?? 0;
      const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;

      if (shouldRefresh && oauth.refreshToken) {
        const refreshed = await refreshXaiToken(decryptToken(oauth.refreshToken, encryptionKey));
        await upsertXaiAuth({
          accessToken: encryptToken(refreshed.accessToken, encryptionKey),
          refreshToken: refreshed.refreshToken
            ? encryptToken(refreshed.refreshToken, encryptionKey)
            : oauth.refreshToken,
          expiresAt: refreshed.expiresAt,
          scope: refreshed.scope,
        });
        return `Bearer ${refreshed.accessToken}`;
      }

      return `Bearer ${decryptToken(oauth.accessToken, encryptionKey)}`;
    }
  }

  const apiKey = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Grok認証が未設定です");
  return `Bearer ${apiKey}`;
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
  const body: Record<string, unknown> = {
    model: options.model ?? getDefaultModel(),
    input: options.messages,
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
