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
  if (error.message.includes("CLAUDE_API_KEY")) {
    return "Claude APIキーが設定されていません。設定画面またはVercel環境変数を確認してください。";
  }
  if (error.message.includes("GROK_API_KEY")) {
    return "Grok APIキーが設定されていません。設定画面またはVercel環境変数を確認してください。";
  }
  if (error.message.includes("KIMI_API_KEY")) {
    return "Kimi APIキーが設定されていません。設定画面またはVercel環境変数を確認してください。";
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
  if (error.message.includes("X API error: 403")) {
    return "X APIの権限またはプラン制限により取得できませんでした。X Developer Portalの権限、X_SCOPES、APIプランを確認してから再接続してください。";
  }
  if (error.message.includes("X API error: 401")) {
    return "X連携の認証または権限が無効です。一度Xアカウントの接続を解除し、再接続してから同期してください。";
  }
  if (error.message.includes("X API error: 429")) {
    return "X APIのレート制限に達しました。少し時間を置いてから再実行してください。";
  }
  if (error.message.toLowerCase().includes("compute time quota")) {
    return "実行時間の利用上限に達しています。Vercel Functions、Neon compute、またはAIプロバイダ側のquotaがまだ解除されていない可能性があります。Vercel Logsで直前の provider=... / DATABASE / function timeout を確認してください。";
  }
  if (
    error.message.includes("RESOURCE_EXHAUSTED") ||
    error.message.includes("code\":429") ||
    error.message.includes("Quota exceeded") ||
    error.message.includes("rate-limit")
  ) {
    return "Gemini APIの利用上限に達しました。少し時間を置いて再実行するか、Google AI Studio側で課金/上限設定を確認してください。";
  }

  return error.message || fallback;
}
