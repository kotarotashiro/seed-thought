import { NextResponse } from "next/server";
import {
  getAiRuntimeSettings,
  getEnvApiKey,
  getProviderModelOptions,
  saveAiSettings,
  type AiProviderName,
} from "@/lib/ai/settings";
import { getAiProvider } from "@/lib/ai/provider";
import { getUserFacingError } from "@/lib/api/errors";

const providers: AiProviderName[] = ["grok"];

export async function GET() {
  try {
    const settings = await getAiRuntimeSettings();
    const providerOptions = await Promise.all(
      providers.map(async (provider) => {
        const apiKey = provider === settings.provider ? settings.apiKey : getEnvApiKey(provider);
        const options = await getProviderModelOptions(provider, apiKey);
        return {
          value: provider,
          label: "Grok (xAI)",
          defaultModel: options.defaultModel,
          modelsSource: options.source,
          models: options.models.map((model) => ({ value: model, label: model })),
        };
      })
    );

    return NextResponse.json({
      provider: settings.provider,
      model: settings.model,
      hasApiKey: settings.hasApiKey,
      keySource: settings.keySource,
      providers: providerOptions,
    });
  } catch (error) {
    console.error("Failed to load AI settings:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "AI設定の取得に失敗しました") },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    // Always use grok — only model and apiKey are variable
    const settings = await saveAiSettings({
      provider: "grok",
      model: typeof body.model === "string" ? body.model : undefined,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      clearApiKey: Boolean(body.clearApiKey),
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to save AI settings:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "AI設定の保存に失敗しました") },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const provider = getAiProvider();
    const result = await provider.classifyPost({
      text: "AI設定の接続テストです。短く分類してください。",
    });
    return NextResponse.json({
      success: true,
      summary: result.summary,
      category: result.primaryCategory,
    });
  } catch (error) {
    console.error("AI settings test failed:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "AI接続テストに失敗しました") },
      { status: 500 }
    );
  }
}
