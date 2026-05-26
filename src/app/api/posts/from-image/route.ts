import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/xai/client";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "image ファイルが必要です" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const authHeader = await getAuthHeader();

    const res = await fetch(XAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL ?? "grok-4.3",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
              {
                type: "text",
                text: "この画像の内容を日本語で詳しく説明してください。テキストが含まれている場合はすべて書き起こし、図や表があれば内容を解説してください。学習メモとして活用できる形式でまとめてください。",
              },
            ],
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`xAI Vision ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!content) {
      return NextResponse.json({ error: "画像を解析できませんでした" }, { status: 422 });
    }

    return NextResponse.json({ text: content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "画像解析に失敗しました";
    console.error("[from-image]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
