import type { AiProvider } from "./types";
import { mockProvider } from "./mockProvider";
import { openaiProvider } from "./openaiProvider";
import { geminiProvider } from "./geminiProvider";

export function getAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER || "gemini";

  switch (provider) {
    case "openai":
      return openaiProvider;
    case "gemini":
      return geminiProvider;
    case "mock":
    default:
      return mockProvider;
  }
}
