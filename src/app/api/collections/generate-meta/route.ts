import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { getAiRuntimeSettings } from "@/lib/ai/settings";

function getOpenAiBaseUrl(provider: string): string | undefined {
  if (provider === "grok") return "https://api.x.ai/v1";
  if (provider === "kimi") return "https://api.moonshot.ai/v1";
  return undefined;
}

async function callProvider(prompt: string): Promise<string> {
  const settings = await getAiRuntimeSettings();
  if (!settings.apiKey) throw new Error("AI APIキーが設定されていません");

  if (settings.provider === "gemini") {
    const client = new GoogleGenAI({ apiKey: settings.apiKey });
    const response = await client.models.generateContent({
      model: settings.model,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    return response.text || "{}";
  }

  if (settings.provider === "claude") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 512,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
    const data = await response.json();
    const blocks = Array.isArray(data.content)
      ? data.content
          .filter((b: { type?: string }) => b.type === "text")
          .map((b: { text?: string }) => b.text || "")
      : [];
    return blocks.join("\n").trim() || "{}";
  }

  if (
    settings.provider === "openai" ||
    settings.provider === "grok" ||
    settings.provider === "kimi"
  ) {
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: getOpenAiBaseUrl(settings.provider),
    });
    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    return response.choices[0]?.message?.content || "{}";
  }

  throw new Error("対応していないAIプロバイダーです");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cardIds?: string[] };
    const cardIds = Array.isArray(body.cardIds) ? body.cardIds : [];

    if (cardIds.length === 0) {
      return NextResponse.json(
        { error: "学習カードを選択してください" },
        { status: 400 }
      );
    }

    const cards = await prisma.learningCard.findMany({
      where: { id: { in: cardIds } },
      select: { title: true, summary: true, coreInsight: true },
    });

    const cardList = (
      cards as Array<{ title: string; summary: string; coreInsight: string }>
    )
      .map(
        (c, i) =>
          `${i + 1}. ${c.title}\n要約: ${c.summary}\n中心洞察: ${c.coreInsight}`
      )
      .join("\n\n");

    const prompt = `以下の学習カード${cards.length}枚をまとめたコレクションのタイトルと説明を日本語で生成してください。

学習カード一覧:
${cardList}

条件:
- タイトルは20文字以内で、コレクションの価値が伝わるキャッチーな表現にする
- 説明は40〜80文字で、このコレクションの狙いと対象者が伝わるようにする
- 既存のカードタイトルをそのまま使わず、束ねた価値を表現する

JSON形式のみで出力:
{"title": "タイトル", "description": "説明文"}`;

    const raw = await callProvider(prompt);
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: { title?: string; description?: string } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Return empty strings if parse fails; client shows a fallback message
    }

    return NextResponse.json({
      title: parsed.title || "",
      description: parsed.description || "",
    });
  } catch (error) {
    console.error("Failed to generate collection meta:", error);
    const message =
      error instanceof Error ? error.message : "生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
