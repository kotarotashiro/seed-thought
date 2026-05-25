// Grok Imagine image generation via xAI API.
// Phase 5: API key auth. TODO: switch to OAuth when xAI opens web app client registration
// (see src/lib/xai/client.ts getAuthHeader() for the OAuth stub).

import type { GeneratedImage } from "./imageProvider";

const XAI_API_BASE = "https://api.x.ai/v1";

const BW_STYLE_PREFIX =
  "Minimalist black and white illustration, clean simple lines, flat design, white background, no color, no shading, easy to read at a glance. Subject: ";

function getApiKey(): string {
  const key = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
  if (!key) throw new Error("GROK_API_KEY is not set");
  return key;
}

function getApiModel(): string {
  return process.env.GROK_IMAGE_MODEL ?? "grok-2-image-1212";
}

export async function generateImageWithGrok(prompt: string): Promise<GeneratedImage> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("プロンプトが空です");

  const styledPrompt = BW_STYLE_PREFIX + trimmed;
  const apiKey = getApiKey();

  const res = await fetch(`${XAI_API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getApiModel(),
      prompt: styledPrompt,
      n: 1,
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok Imagine API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Grok Imagine: 画像データが返されませんでした");
  }

  return { mimeType: "image/png", dataBase64: b64 };
}
