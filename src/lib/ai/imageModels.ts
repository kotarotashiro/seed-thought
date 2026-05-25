// Shared image model definitions — safe to import in both client and server code.

export const GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
] as const;

export type GeminiImageModel = (typeof GEMINI_IMAGE_MODELS)[number];

export const DEFAULT_GEMINI_IMAGE_MODEL: GeminiImageModel = "gemini-2.5-flash-image";

// Phase 5: Grok Imagine via xAI API key (OAuth stub ready in src/lib/xai/client.ts)
export const GROK_IMAGE_MODELS = ["grok-imagine"] as const;
export type GrokImageModel = (typeof GROK_IMAGE_MODELS)[number];

export const ALL_IMAGE_MODELS = [
  ...GEMINI_IMAGE_MODELS,
  ...GROK_IMAGE_MODELS,
] as const;

export type ImageModel = (typeof ALL_IMAGE_MODELS)[number];

export const DEFAULT_IMAGE_MODEL: ImageModel = DEFAULT_GEMINI_IMAGE_MODEL;

export interface ImageProviderOption {
  id: ImageModel;
  label: string;
}

export const IMAGE_PROVIDER_OPTIONS: ImageProviderOption[] = [
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5" },
  { id: "gemini-3.1-flash-image-preview", label: "Gemini 3.1" },
  { id: "grok-imagine", label: "Grok Imagine" },
];
