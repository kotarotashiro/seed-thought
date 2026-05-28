import { NextResponse } from "next/server";
import {
  getProviderApiKey,
  getProviderModelOptions,
  type AiProviderName,
} from "@/lib/ai/settings";
import { getUserFacingError } from "@/lib/api/errors";

const VALID_PROVIDERS: AiProviderName[] = ["grok", "claude", "openai", "gemini", "kimi"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") as AiProviderName | null;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "provider パラメータが不正です" }, { status: 400 });
    }

    const apiKey = await getProviderApiKey(provider);
    const result = await getProviderModelOptions(provider, apiKey);

    return NextResponse.json({
      provider,
      models: result.models,
      source: result.source,
    });
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "モデル一覧の取得に失敗しました") },
      { status: 500 }
    );
  }
}
