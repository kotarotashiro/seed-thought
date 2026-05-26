// Shared image model definitions — safe to import in both client and server code.

export const GROK_IMAGE_MODELS = ["grok-imagine"] as const;
export type GrokImageModel = (typeof GROK_IMAGE_MODELS)[number];
export const DEFAULT_GROK_IMAGE_MODEL: GrokImageModel = "grok-imagine";

export const ALL_IMAGE_MODELS = [...GROK_IMAGE_MODELS] as const;
export type ImageModel = (typeof ALL_IMAGE_MODELS)[number];
export const DEFAULT_IMAGE_MODEL: ImageModel = DEFAULT_GROK_IMAGE_MODEL;

export interface ImageProviderOption {
  id: ImageModel;
  label: string;
}

export const IMAGE_PROVIDER_OPTIONS: ImageProviderOption[] = [
  { id: "grok-imagine", label: "Grok Imagine" },
];
