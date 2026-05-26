import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { xaiChat } from "@/lib/xai/client";

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

    const { content: raw } = await xaiChat({
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.7,
    });

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
