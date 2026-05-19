import { NextResponse } from "next/server";
import {
  getAiPublicSettings,
  getDefaultModel,
  getModelPresets,
  saveAiSettings,
  type AiProviderName,
} from "@/lib/ai/settings";
import { getAiProvider } from "@/lib/ai/provider";
import { getUserFacingError } from "@/lib/api/errors";

const providers: AiProviderName[] = ["gemini", "openai", "claude", "grok", "kimi"];

function normalizeProvider(value: unknown): AiProviderName | null {
  const provider = String(value || "");
  return providers.includes(provider as AiProviderName) ? (provider as AiProviderName) : null;
}

export async function GET() {
  try {
    const settings = await getAiPublicSettings();
    return NextResponse.json({
      ...settings,
      providers: providers.map((provider) => ({
        value: provider,
        label:
          provider === "gemini"
            ? "Gemini"
            : provider === "openai"
            ? "OpenAI"
            : provider === "claude"
            ? "Claude"
            : provider === "grok"
            ? "Grok"
            : "Kimi",
        defaultModel: getDefaultModel(provider),
        models: getModelPresets(provider).map((model) => ({
          value: model,
          label: model,
        })),
      })),
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
    const provider = normalizeProvider(body.provider);
    if (!provider) {
      return NextResponse.json({ error: "AI Providerを選択してください" }, { status: 400 });
    }

    const settings = await saveAiSettings({
      provider,
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
