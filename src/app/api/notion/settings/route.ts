import { NextResponse } from "next/server";
import { getNotionSettings, saveNotionSettings } from "@/lib/notion/settings";

export async function GET() {
  try {
    const settings = await getNotionSettings();
    return NextResponse.json({
      hasApiKey: settings.hasApiKey,
      databaseId: settings.databaseId,
    });
  } catch (error) {
    console.error("Failed to load Notion settings:", error);
    return NextResponse.json({ error: "Notion設定の取得に失敗しました" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const saved = await saveNotionSettings({
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      databaseId: typeof body.databaseId === "string" ? body.databaseId : undefined,
      clearApiKey: Boolean(body.clearApiKey),
    });
    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save Notion settings:", error);
    return NextResponse.json({ error: "Notion設定の保存に失敗しました" }, { status: 500 });
  }
}
