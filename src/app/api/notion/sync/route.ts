import { NextResponse } from "next/server";
import { getNotionSettings } from "@/lib/notion/settings";
import { syncLearningCardsToNotion } from "@/lib/notion/sync";
import { resetNotionClient } from "@/lib/notion/client";

export async function POST() {
  try {
    const settings = await getNotionSettings();
    if (!settings.apiKey) {
      return NextResponse.json({ error: "Notion APIキーが設定されていません" }, { status: 400 });
    }
    if (!settings.databaseId) {
      return NextResponse.json({ error: "NotionデータベースIDが設定されていません" }, { status: 400 });
    }

    // Reset client so it picks up the latest key.
    resetNotionClient();

    const result = await syncLearningCardsToNotion(settings.apiKey, settings.databaseId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Notion sync failed:", error);
    const message = error instanceof Error ? error.message : "Notion同期に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
