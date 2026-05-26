import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/xai/client";

const XAI_STT_URL = "https://api.x.ai/v1/audio/transcriptions";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "audio ファイルが必要です" }, { status: 400 });
    }

    const authHeader = await getAuthHeader();

    const xaiForm = new FormData();
    xaiForm.append("file", file, "audio.webm");
    xaiForm.append("model", "whisper-large-v3");

    const res = await fetch(XAI_STT_URL, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: xaiForm,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`xAI STT ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as { text?: string };
    const transcript = data.text?.trim() ?? "";

    if (!transcript) {
      return NextResponse.json({ error: "音声を認識できませんでした" }, { status: 422 });
    }

    return NextResponse.json({ text: transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "音声認識に失敗しました";
    console.error("[from-audio]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
