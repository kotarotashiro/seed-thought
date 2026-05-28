import { NextResponse } from "next/server";
import {
  getAiPublicSettings,
  getAiRuntimeSettings,
  getProviderModelOptions,
  saveAiSettings,
  PROVIDER_LABELS,
  TASK_LABELS,
  type AiProviderName,
  type AiTaskName,
  type AiTaskAssignment,
} from "@/lib/ai/settings";
import { getAiProvider } from "@/lib/ai/provider";
import { getUserFacingError } from "@/lib/api/errors";

const PROVIDERS: AiProviderName[] = ["grok", "claude", "openai", "gemini", "kimi"];

export async function GET() {
  try {
    const settings = await getAiPublicSettings();
    return NextResponse.json({
      defaultProvider: settings.defaultProvider,
      defaultModel: settings.defaultModel,
      taskAssignments: settings.taskAssignments,
      keyStatus: settings.keyStatus,
      providers: PROVIDERS.map((p) => ({
        value: p,
        label: PROVIDER_LABELS[p],
        hasKey: settings.keyStatus[p]?.hasKey ?? false,
        keySource: settings.keyStatus[p]?.source ?? "none",
      })),
      taskLabels: TASK_LABELS,
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

    const input: Parameters<typeof saveAiSettings>[0] = {};

    if (typeof body.defaultProvider === "string") {
      input.defaultProvider = body.defaultProvider as AiProviderName;
    }
    if (typeof body.defaultModel === "string") {
      input.defaultModel = body.defaultModel;
    }
    if (body.taskAssignments && typeof body.taskAssignments === "object") {
      input.taskAssignments = body.taskAssignments as Partial<
        Record<AiTaskName, AiTaskAssignment | null>
      >;
    }
    if (body.apiKeys && typeof body.apiKeys === "object") {
      input.apiKeys = body.apiKeys as Partial<Record<AiProviderName, string | null>>;
    }

    const settings = await saveAiSettings(input);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to save AI settings:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "AI設定の保存に失敗しました") },
      { status: 500 }
    );
  }
}

// 接続テスト
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
