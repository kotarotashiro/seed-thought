import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMClient, ModelInfo, ModelListResult, ProviderConfig } from "./types";

const FALLBACK_MODELS: ModelInfo[] = [
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
];

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: controller.signal, cache: "no-store" }
    );
    if (!res.ok) {
      console.warn(`[geminiProvider] /v1beta/models returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
    };
    if (!Array.isArray(data.models)) return [];
    return data.models
      .filter(
        (m) =>
          typeof m.name === "string" &&
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent")
      )
      .map((m) => {
        const id = m.name.replace(/^models\//, "");
        return { id, name: m.displayName || id };
      });
  } catch (err) {
    console.warn("[geminiProvider] failed to fetch models:", err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const modelCache = new Map<string, { models: ModelInfo[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function getGeminiModels(apiKey: string | null): Promise<ModelListResult> {
  if (!apiKey) return { models: FALLBACK_MODELS, source: "fallback" };

  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { models: cached.models, source: "live" };
  }

  const live = await fetchGeminiModels(apiKey);
  if (live.length > 0) {
    modelCache.set(apiKey, { models: live, fetchedAt: Date.now() });
    return { models: live, source: "live" };
  }
  return { models: FALLBACK_MODELS, source: "fallback" };
}

export function getGeminiClient(config: ProviderConfig): LLMClient {
  const genAI = new GoogleGenerativeAI(config.apiKey);

  return {
    async chatJson(prompt, opts) {
      const model = genAI.getGenerativeModel({
        model: config.model,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: opts?.temperature ?? 0.4,
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text() || "{}";
    },
    async chatText(prompt, opts) {
      const model = genAI.getGenerativeModel({
        model: config.model,
        generationConfig: {
          temperature: opts?.temperature ?? 0.7,
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text() || "";
    },
  };
}
