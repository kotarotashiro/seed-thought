import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import { getUserFacingError } from "@/lib/api/errors";
import { getPostForLearning, buildSourcePost } from "@/lib/posts/learningSource";
import { XaiTokenExpiredError } from "@/lib/xai/oauth";

// 厳密学習生成（LLM 1回）。学習カードとは別ルートに分離し、各リクエストを
// 60秒枠に収める。学習カードが先に存在している前提で、生成後に
// learningCard.strictLearningJson を更新する。
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  try {
    const post = await getPostForLearning(postId);
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }
    if (!post.learningCard) {
      return NextResponse.json(
        { error: "先に学習カードを生成してください" },
        { status: 409 }
      );
    }

    const source = await buildSourcePost(post);

    const strictLearningOutput = await getAiProvider().generateStrictLearning({
      postText: source.text,
      classification: {
        primaryCategory: post.classification?.primaryCategory || "",
        summary: post.classification?.summary || "",
      },
      articleTitle: source.articleTitle,
      articleDescription: source.articleDescription,
      userMemo: post.learningCard.userMemo ?? null,
    });

    await prisma.learningCard.update({
      where: { sourcePostId: post.id },
      data: { strictLearningJson: JSON.stringify(strictLearningOutput) },
    });

    return NextResponse.json({ strictLearning: strictLearningOutput }, { status: 201 });
  } catch (error) {
    console.error("Failed to generate strict learning:", error);
    if (error instanceof XaiTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "GROK_TOKEN_EXPIRED" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: getUserFacingError(error, "厳密学習の生成に失敗しました") },
      { status: 500 }
    );
  }
}
