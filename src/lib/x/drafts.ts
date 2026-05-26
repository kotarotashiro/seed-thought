import { prisma } from "@/lib/db/prisma";
import { xaiChat } from "@/lib/xai/client";
import { getProfile } from "@/lib/profile/fixedProfile";

async function buildDraftPrompt(card: {
  title: string;
  summary: string;
  coreInsight: string;
}): Promise<string> {
  const profile = await getProfile();
  return `あなたは${profile.name}（${profile.role}）のX投稿ゴーストライターです。
以下の学びカードから、自然でエンゲージメントの高い日本語X投稿を1つ作成してください。

## 学びカード
タイトル: ${card.title}
要約: ${card.summary}
核心: ${card.coreInsight}

## ルール
- 文字数: 200文字以内
- 語尾: 断定調・体言止め可
- トーン: ${profile.tone}
- 絵文字は1〜2個まで
- ハッシュタグ不要
- 元投稿への言及不要

## 出力 (JSONのみ)
{"content": "投稿本文"}`;
}

export async function generateDraftForCard(learningCardId: string): Promise<void> {
  const card = await prisma.learningCard.findUnique({
    where: { id: learningCardId },
    select: { id: true, title: true, summary: true, coreInsight: true, status: true },
  });

  if (!card || card.status !== "saved") return;

  const existing = await prisma.xDraft.findFirst({
    where: { learningCardId, status: "pending" },
  });
  if (existing) return;

  try {
    const prompt = await buildDraftPrompt(card);
    const { content: raw } = await xaiChat({
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.7,
    });

    let content = raw.trim();
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { content?: string };
        if (parsed.content) content = parsed.content;
      }
    } catch {
      // use raw text
    }

    if (!content) return;

    await prisma.xDraft.create({ data: { learningCardId, content } });
  } catch (error) {
    console.error("Draft generation failed for card", learningCardId, error);
  }
}
