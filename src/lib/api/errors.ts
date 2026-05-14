import { AiJsonError } from "@/lib/ai/json";

export function getUserFacingError(error: unknown, fallback: string): string {
  if (error instanceof AiJsonError) return error.message;
  if (!(error instanceof Error)) return fallback;

  if (error.message.includes("GEMINI_API_KEY")) {
    return "Gemini APIキーが設定されていません。.env の GEMINI_API_KEY を確認してください。";
  }
  if (error.message.includes("OPENAI_API_KEY")) {
    return "OpenAI APIキーが設定されていません。.env の OPENAI_API_KEY を確認してください。";
  }
  if (error.message.includes("X_CLIENT_ID")) {
    return "X_CLIENT_ID が設定されていません。.env と X Developer Portal の設定を確認してください。";
  }
  if (error.message.includes("TOKEN_ENCRYPTION_KEY")) {
    return "TOKEN_ENCRYPTION_KEY が設定されていません。.env を確認してください。";
  }
  if (error.message.includes("DATABASE_URL")) {
    return "DATABASE_URL が設定されていません。Postgres の接続文字列を .env またはVercel環境変数に設定してください。";
  }

  return error.message || fallback;
}
