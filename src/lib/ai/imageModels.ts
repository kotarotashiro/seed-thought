// Shared image model definitions — safe to import in both client and server code.
// Phase 5: add "grok-imagine" to IMAGE_PROVIDERS when xAI OAuth is wired up.

export const GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
] as const;

export type GeminiImageModel = (typeof GEMINI_IMAGE_MODELS)[number];

export const DEFAULT_GEMINI_IMAGE_MODEL: GeminiImageModel = "gemini-2.5-flash-image";

export interface ImageProviderOption {
  id: GeminiImageModel; // extend union in Phase 5
  label: string;
}

export const IMAGE_PROVIDER_OPTIONS: ImageProviderOption[] = [
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5" },
  { id: "gemini-3.1-flash-image-preview", label: "Gemini 3.1" },
  // Phase 5: { id: "grok-imagine", label: "Grok Imagine" },
];
