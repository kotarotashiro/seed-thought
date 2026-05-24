import { GoogleGenAI } from "@google/genai";

export interface GeneratedImage {
  mimeType: string;
  dataBase64: string;
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function getImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL || "gemini-2.0-flash-preview-image-generation";
}

const BW_STYLE_PREFIX =
  "Minimalist black and white illustration, clean simple lines, flat design, white background, no color, no shading, easy to read at a glance. Subject: ";

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("プロンプトが空です");
  }
  const client = getClient();
  const styledPrompt = BW_STYLE_PREFIX + trimmed;

  const response = await client.models.generateContent({
    model: getImageModel(),
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
