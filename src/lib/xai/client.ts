// xAI client — OAuth bearer preferred, API key fallback.

import { getXaiAccessToken } from "@/lib/xai/refresh";
import { findXaiAuth } from "@/lib/xai/authStore";
import { XaiTokenExpiredError } from "@/lib/xai/oauth";
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

type XaiAuthResolution = {
  header: string;
  source: "oauth" | "api-key";
  storedAccessToken?: string;
};

async function resolveAuthHeader(options: {
  force?: boolean;
  expectedStoredAccessToken?: string;
} = {}): Promise<XaiAuthResolution> {
  if (process.env.XAI_CLIENT_ID) {
    const oauth = await getXaiAccessToken(options);
    if (oauth) {
      return {
        header: `Bearer ${oauth.token}`,
        source: "oauth",
        storedAccessToken: oauth.storedAccessToken,
      };
    }
  }

  const apiKey = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
  if (apiKey) return { header: `Bearer ${apiKey}`, source: "api-key" };

  if (process.env.XAI_CLIENT_ID) {
    throw new XaiTokenExpiredError();
  }
  throw new Error("Grok認証が未設定です");
}

export async function getAuthHeader(): Promise<string> {
  return (await resolveAuthHeader()).header;
}

/**
 * xAI APIへの共通fetch。OAuth bearerで401になった時だけ、1回refreshして再試行する。
 * APIキー利用時の401は、無関係なOAuth refreshを発生させない。
 */
export async function xaiFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const auth = await resolveAuthHeader();
  const send = (authorization: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", authorization);
    return fetch(input, { ...init, headers });
  };

  let response = await send(auth.header);
  if (response.status !== 401 || auth.source !== "oauth") return response;

  // リトライ前にレスポンスを消費して、Nodeの接続を再利用可能にする。
  await response.text();
  const refreshedAuth = await resolveAuthHeader({
    force: true,
    expectedStoredAccessToken: auth.storedAccessToken,
  });
  response = await send(refreshedAuth.header);
  return response;
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

  const res = await xaiFetch(`${XAI_API_BASE}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
