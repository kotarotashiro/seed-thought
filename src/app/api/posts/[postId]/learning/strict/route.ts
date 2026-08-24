import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import { getUserFacingError } from "@/lib/api/errors";
import { getPostForLearning, buildSourcePost } from "@/lib/posts/learningSource";
import { buildLearningGenerationMetadata, LearningMaterialsIncompleteError, prepareLearningMaterials } from "@/lib/posts/learningMaterials";
import { XaiTokenExpiredError } from "@/lib/xai/oauth";

// 厳密学習生成（LLM 1回）。学習カードとは別ルートに分離。学習カードが先に
// 存在している前提で、生成後に learningCard.strictLearningJson を更新する。
// Vercel Hobby(Fluid Compute)の上限300秒まで引き上げ、遅いモデルでも打ち切らない。
export const maxDuration = 300;

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

    const prepared = await prepareLearningMaterials(postId);
    const source = await buildSourcePost(prepared.post, prepared.materials);

    const strictLearningOutput = await getAiProvider().generateStrictLearning({
      postText: source.text,
      classification: {
        primaryCategory: post.classification?.primaryCategory || "",
        summary: post.classification?.summary || "",
      },
      articleTitle: source.articleTitle,
      articleDescription: source.articleDescription,
      learningMaterials: prepared.materials,
      learningCardJson: post.learningCard.outputJson,
      userMemo: post.learningCard.userMemo ?? null,
    });
    const strictWithMetadata = {
      ...strictLearningOutput,
      learningMetadata: buildLearningGenerationMetadata(prepared.materials),
    };

    await prisma.learningCard.update({
      where: { sourcePostId: post.id },
      data: { strictLearningJson: JSON.stringify(strictWithMetadata) },
    });

    return NextResponse.json({ strictLearning: strictWithMetadata }, { status: 201 });
  } catch (error) {
    console.error("Failed to generate strict learning:", error);
    if (error instanceof LearningMaterialsIncompleteError) {
      return NextResponse.json(
        {
          error: "厳密学習に必要な補助情報が不足しています。表示された素材を準備してください。",
          code: error.code,
          missingSources: error.missingSources,
          materials: error.materials,
        },
        { status: 409 },
      );
    }
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
