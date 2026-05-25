// xAI client — OAuth bearer preferred, API key fallback.

import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/x/tokenStore";
import {
  getXaiTokenEncryptionKey,
  refreshXaiToken,
  XAI_OAUTH_ID,
} from "@/lib/xai/oauth";

const XAI_API_BASE = "https://api.x.ai/v1";

export type XaiSource = { type: "web" } | { type: "x" };

export interface XaiChatOptions {
  model?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  searchParameters?: {
    mode?: "on" | "off" | "auto";
    sources?: XaiSource[];
  };
}

export interface XaiChatResult {
  content: string;
}

export interface XaiImagineOptions {
  prompt: string;
  n?: number;
}

export interface XaiImagineResult {
  // Phase 5: populated when OAuth and grok-imagine-image-quality are wired up
  imageUrl?: string;
  dataBase64?: string;
  mimeType?: string;
}

export async function getAuthHeader(): Promise<string> {
  if (process.env.XAI_CLIENT_ID) {
    const oauth = await prisma.xAuth.findUnique({ where: { id: XAI_OAUTH_ID } });

    if (oauth?.accessToken) {
      const encryptionKey = getXaiTokenEncryptionKey();
      if (!encryptionKey) throw new Error("XAI_ENCRYPTION_KEY is not set");

      const expiresAt = oauth.expiresAt?.getTime() ?? 0;
      const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;

      if (shouldRefresh && oauth.refreshToken) {
        const refreshed = await refreshXaiToken(decryptToken(oauth.refreshToken, encryptionKey));
        await prisma.xAuth.update({
          where: { id: oauth.id },
          data: {
            accessToken: encryptToken(refreshed.accessToken, encryptionKey),
            refreshToken: refreshed.refreshToken
              ? encryptToken(refreshed.refreshToken, encryptionKey)
              : undefined,
            expiresAt: refreshed.expiresAt,
            scope: refreshed.scope,
          },
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

  const oauth = await prisma.xAuth.findUnique({
    where: { id: XAI_OAUTH_ID },
    select: { id: true },
  });
  return Boolean(oauth);
}

function getDefaultModel(): string {
  return process.env.GROK_MODEL ?? process.env.XAI_MODEL ?? "grok-3";
}

export async function xaiChat(options: XaiChatOptions): Promise<XaiChatResult> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${XAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      model: options.model ?? getDefaultModel(),
      messages: options.messages,
      ...(options.searchParameters
        ? { search_parameters: options.searchParameters }
        : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return { content: data.choices?.[0]?.message?.content ?? "" };
}

export async function xaiSearchX(query: string): Promise<XaiChatResult> {
  return xaiChat({
    messages: [{ role: "user", content: query }],
    searchParameters: { mode: "on", sources: [{ type: "x" }] },
  });
}

export async function xaiSearchWeb(query: string): Promise<XaiChatResult> {
  return xaiChat({
    messages: [{ role: "user", content: query }],
    searchParameters: { mode: "on", sources: [{ type: "web" }] },
  });
}

// Phase 5: implement when xAI OAuth is wired up for zero-cost image generation.
// Until then, callers should fall back to Gemini providers.
export async function xaiImagine(options: XaiImagineOptions): Promise<XaiImagineResult> {
  void options;
  throw new Error("xaiImagine not yet implemented — implement in Phase 5 with OAuth");
}
