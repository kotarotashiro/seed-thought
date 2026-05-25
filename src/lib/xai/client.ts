// xAI client — OAuth bearer preferred, API key fallback.
// TODO: switch to OAuth when xAI opens web app client registration.
// Phase 5: xaiImagine() will use OAuth bearer for zero-cost image generation.

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

function getAuthHeader(): string {
  const apiKey = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("GROK_API_KEY is not set");
  // TODO: check XAuth table for OAuth token first (Phase 5/6)
  return `Bearer ${apiKey}`;
}

function getDefaultModel(): string {
  return process.env.GROK_MODEL ?? process.env.XAI_MODEL ?? "grok-3";
}

export async function xaiChat(options: XaiChatOptions): Promise<XaiChatResult> {
  const res = await fetch(`${XAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
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
export async function xaiImagine(_options: XaiImagineOptions): Promise<XaiImagineResult> {
  throw new Error("xaiImagine not yet implemented — implement in Phase 5 with OAuth");
}
