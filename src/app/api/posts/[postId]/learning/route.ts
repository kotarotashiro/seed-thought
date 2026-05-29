import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { SourcePostForLearning } from "@/lib/ai/types";
import { getUserFacingError } from "@/lib/api/errors";
import { getPostForLearning, buildSourcePost } from "@/lib/posts/learningSource";
import { XaiTokenExpiredError } from "@/lib/xai/oauth";

// 学習カード生成（LLM 1回）。厳密学習は別ルート（./strict）で生成するため、
// このルートは1呼び出しで完結し、遅いモデルでも60秒枠に収まりやすい。
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  try {
    const post = await getPostForLearning(postId);
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    const strictLearning = post.learningCard?.strictLearningJson
      ? (() => { try { return JSON.parse(post.learningCard!.strictLearningJson!); } catch { return null; } })()
      : null;

    return NextResponse.json({ post, learningCard: post.learningCard, strictLearning });
  } catch (error) {
    console.error("Failed to fetch learning card:", error);
    return NextResponse.json({ error: "学習カードの取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const learningMode: "content" | "format" =
      (body as { learningMode?: string }).learningMode === "format" ? "format" : "content";

    const post = await getPostForLearning(postId);
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    const source = await buildSourcePost(post);
    const sourceWithMode: SourcePostForLearning = { ...source, learningMode };

    const learningOutput = await getAiProvider().generateLearningCard(sourceWithMode);
    const draftOutput = { ...learningOutput, sourcePostId: post.id, status: "draft" as const };

    // 学習カードを再生成したら厳密学習は古くなるため null に戻し、クライアント側で別途再生成させる。
    const learningCard = await prisma.learningCard.upsert({
      where: { sourcePostId: post.id },
      create: {
        sourcePostId: post.id,
        title: draftOutput.title,
        summary: draftOutput.summary,
        coreInsight: draftOutput.coreInsight,
        manual: draftOutput.manual,
        diagramPrompt: JSON.stringify(draftOutput.diagramStructure),
        imagePrompt: draftOutput.imageExplanationPrompt,
        outputJson: JSON.stringify(draftOutput),
        userMemo: draftOutput.userLearningMemo,
        status: "draft",
        learningMode,
        strictLearningJson: null,
      },
      update: {
        title: draftOutput.title,
        summary: draftOutput.summary,
        coreInsight: draftOutput.coreInsight,
        manual: draftOutput.manual,
        diagramPrompt: JSON.stringify(draftOutput.diagramStructure),
        imagePrompt: draftOutput.imageExplanationPrompt,
        outputJson: JSON.stringify(draftOutput),
        userMemo: draftOutput.userLearningMemo,
        status: "draft",
        learningMode,
        strictLearningJson: null,
      },
    });

    return NextResponse.json(
      { learningCard, output: draftOutput, strictLearning: null },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to generate learning card:", error);
    if (error instanceof XaiTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "GROK_TOKEN_EXPIRED" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: getUserFacingError(error, "学習カードの生成に失敗しました") },
      { status: 500 }
    );
  }
}
