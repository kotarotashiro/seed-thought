import {
  ALL_IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL,
  type ImageModel,
} from "./imageModels";
import { generateImageWithGrok } from "./grokImageProvider";

export type { ImageModel };
export { ALL_IMAGE_MODELS, DEFAULT_IMAGE_MODEL };

export interface GeneratedImage {
  mimeType: string;
  dataBase64: string;
}

export async function generateImage(
  prompt: string,
  _model?: ImageModel | null
): Promise<GeneratedImage> {
  return generateImageWithGrok(prompt);
}
