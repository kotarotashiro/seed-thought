import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFacingError } from "@/lib/api/errors";
import { buildCardCopyText } from "@/lib/export/cardCopyText";
import { buildPostTextWithThread } from "@/lib/posts/threadText";
import type { LearningOutput, StrictLearningOutput } from "@/lib/ai/types";

// POST /api/learning-cards/[cardId]/export
// 元の投稿を含めた学習内容全体をMarkdownに整形し、DBに保存（資産として残す）した上で返す。
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  try {
    const card = await prisma.learningCard.findUnique({
      where: { id: cardId },
      include: {
        sourcePost: {
          include: { threadPosts: { orderBy: { threadOrder: "asc" } } },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "学習カードが見つかりません" }, { status: 404 });
    }

    let output: LearningOutput;
    try {
      output = JSON.parse(card.outputJson) as LearningOutput;
    } catch {
      return NextResponse.json({ error: "学習カードのデータ形式が不正です" }, { status: 500 });
    }

    const strict: StrictLearningOutput | null = card.strictLearningJson
      ? (() => {
          try {
            return JSON.parse(card.strictLearningJson!) as StrictLearningOutput;
          } catch {
            return null;
          }
        })()
      : null;

    const post = card.sourcePost;
    const author = post.authorUsername ? `@${post.authorUsername}` : post.authorName ?? null;

    const exportText = buildCardCopyText(
      output,
      strict,
      { title: output.title || card.title, sourceUrl: post.sourceUrl, author },
      buildPostTextWithThread(post)
    );

    await prisma.learningCard.update({
      where: { id: cardId },
      data: { exportText },
    });

    const filename = `${(output.title || card.title || "learning-card").replace(/[\\/:*?"<>|]/g, "")}.md`;

    return NextResponse.json({ exportText, filename });
  } catch (error) {
    console.error("Failed to export learning card:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "エクスポートに失敗しました") },
      { status: 500 }
    );
  }
}
