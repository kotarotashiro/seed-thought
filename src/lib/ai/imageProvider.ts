import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_IMAGE_MODELS,
  DEFAULT_GEMINI_IMAGE_MODEL,
  type GeminiImageModel,
} from "./imageModels";

export type { GeminiImageModel };
export { GEMINI_IMAGE_MODELS, DEFAULT_GEMINI_IMAGE_MODEL };

export interface GeneratedImage {
  mimeType: string;
  dataBase64: string;
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function resolveModel(requested?: GeminiImageModel | null): string {
  if (requested) return requested;
  const env = process.env.GEMINI_IMAGE_MODEL;
  if (env && (GEMINI_IMAGE_MODELS as readonly string[]).includes(env)) return env;
  return DEFAULT_GEMINI_IMAGE_MODEL;
}

const BW_STYLE_PREFIX =
  "Minimalist black and white illustration, clean simple lines, flat design, white background, no color, no shading, easy to read at a glance. Subject: ";

export async function generateImage(
  prompt: string,
  model?: GeminiImageModel | null
): Promise<GeneratedImage> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("プロンプトが空です");
  }
  const client = getClient();
  const styledPrompt = BW_STYLE_PREFIX + trimmed;

  const response = await client.models.generateContent({
    model: resolveModel(model),
    contents: styledPrompt,
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find(
    (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("画像生成に失敗しました（出力が空）");
  }

  return {
    mimeType: imagePart.inlineData.mimeType || "image/png",
    dataBase64: imagePart.inlineData.data,
  };
}
