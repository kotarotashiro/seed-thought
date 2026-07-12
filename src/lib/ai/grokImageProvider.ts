// Grok Imagine image generation via xAI API.
// Uses OAuth bearer token from getAuthHeader() — X Premium+ / SuperGrok 契約で
// API 課金なしで使える経路。エンドポイントは OpenAI 互換だが、レスポンスが
// URL の場合は別途ダウンロードして base64 化する。

import type { GeneratedImage } from "./imageProvider";
import { xaiFetch } from "@/lib/xai/client";

const XAI_API_BASE = "https://api.x.ai/v1";

const STYLE_PREFIX =
  "Create an infographic illustration. ALL visible text labels, captions, and headings MUST be written in Japanese (日本語: ひらがな・カタカナ・漢字). Do NOT use English text anywhere in the image. Use a clean modern flat design with a readable layout. Subject: ";

function getApiModel(): string {
  return process.env.GROK_IMAGE_MODEL ?? "grok-imagine-image-quality";
}

async function fetchAsBase64(url: string): Promise<{ mimeType: string; dataBase64: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`画像 URL 取得失敗 ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { mimeType, dataBase64: buffer.toString("base64") };
}

export async function generateImageWithGrok(prompt: string): Promise<GeneratedImage> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("プロンプトが空です");

  const styledPrompt = STYLE_PREFIX + trimmed;

  const res = await xaiFetch(`${XAI_API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    data?: Array<{ b64_json?: string; url?: string; base64?: string }>;
  };

  const item = data.data?.[0];
  if (!item) throw new Error("Grok Imagine: 画像データが返されませんでした");

  const direct = item.b64_json ?? item.base64;
  if (direct) return { mimeType: "image/png", dataBase64: direct };

  if (item.url) return fetchAsBase64(item.url);

  throw new Error("Grok Imagine: 画像 URL も base64 も返されませんでした");
}
