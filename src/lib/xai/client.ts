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

function getAuthHeader(): string {
  const apiKey = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("GROK_API_KEY is not set");
  return `Bearer ${apiKey}`;
}

export async function hasXaiAuthConfigured(): Promise<boolean> {
  return Boolean(process.env.GROK_API_KEY ?? process.env.XAI_API_KEY);
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
      Authorization: getAuthHeader(),
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
