export interface LLMClient {
  chatJson(prompt: string, opts?: { temperature?: number }): Promise<string>;
  chatText(prompt: string, opts?: { temperature?: number }): Promise<string>;
}

export interface ProviderConfig {
  model: string;
  apiKey: string;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ModelListResult {
  models: ModelInfo[];
  source: "live" | "fallback";
}
