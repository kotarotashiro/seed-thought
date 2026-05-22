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
  return process.env.GEMINI_IMAGE_MODEL || "imagen-4.0-generate-001";
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("プロンプトが空です");
  }
  const client = getClient();
  const response = await client.models.generateImages({
    model: getImageModel(),
    prompt: trimmed,
    config: {
      numberOfImages: 1,
    },
  });

  const first = response.generatedImages?.[0]?.image;
  const bytes = first?.imageBytes;
  if (!bytes) {
    throw new Error("画像生成に失敗しました（出力が空）");
  }

  return {
    mimeType: first?.mimeType || "image/png",
    dataBase64: bytes,
  };
}
