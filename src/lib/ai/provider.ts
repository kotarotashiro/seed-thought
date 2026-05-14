import type { AiProvider } from "./types";
import { mockProvider } from "./mockProvider";
import { openaiProvider } from "./openaiProvider";
import { geminiProvider } from "./geminiProvider";

export function getAiProvider(): AiProvider {
  const configuredProvider = process.env.AI_PROVIDER || "gemini";
  const provider =
    process.env.NODE_ENV === "production" && configuredProvider === "mock"
      ? "gemini"
      : configuredProvider;

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
