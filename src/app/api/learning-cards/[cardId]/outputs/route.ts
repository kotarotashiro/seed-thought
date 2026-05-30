import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import { getUserFacingError } from "@/lib/api/errors";
import { createFallbackOutput } from "@/lib/ai/fallback";
import type { PostClassificationResult } from "@/lib/ai/types";
import { buildPostTextWithThread } from "@/lib/posts/threadText";

// アウトプット生成は1回のLLM呼び出し。Vercel Hobby(Fluid Compute)上限の300秒まで
// 引き上げ、Kimi等の遅いモデルでも打ち切られないようにする。
export const maxDuration = 300;

const VALID_OUTPUT_TYPES = [
  "x",
  "instagram",
  "short_video",
  "note",
  "markdown_log",
  "seminar",
  "strict_learning",
] as const;
type OutputType = (typeof VALID_OUTPUT_TYPES)[number];

// GET /api/learning-cards/[cardId]/outputs
// List previously generated outputs for a learning card.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  try {
    const outputs = await prisma.learningCardOutput.findMany({
      where: { learningCardId: cardId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ outputs });
  } catch (error) {
    console.error("Failed to fetch learning card outputs:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "履歴の取得に失敗しました") },
      { status: 500 }
    );
  }
}

// POST /api/learning-cards/[cardId]/outputs
// Generate SNS/note output from a learning card's content and save to history.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  try {
    const body = (await request.json()) as { outputType?: string };
    const { outputType } = body;

    if (!outputType || !VALID_OUTPUT_TYPES.includes(outputType as OutputType)) {
      return NextResponse.json({ error: "outputType が不正です" }, { status: 400 });
    }

    const card = await prisma.learningCard.findUnique({
      where: { id: cardId },
      include: {
        sourcePost: {
          include: {
            classification: true,
            threadPosts: { orderBy: { threadOrder: "asc" } },
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "学習カードが見つかりません" }, { status: 404 });
    }

    const post = card.sourcePost;
    const classification: PostClassificationResult = post.classification
      ? {
          postType: post.classification.postType as PostClassificationResult["postType"],
          primaryCategory: post.classification.primaryCategory,
          tags: JSON.parse(post.classification.tagsJson || "[]"),
          summary: post.classification.summary,
          recommendReason: post.classification.recommendReason,
          difficultyLevel: post.classification.difficultyLevel as PostClassificationResult["difficultyLevel"],
          thinkingPotentialScore: post.classification.thinkingPotentialScore,
          learningPotentialScore: post.classification.learningPotentialScore,
          outputPotentialScore: post.classification.outputPotentialScore,
          recommendedMode: post.classification.recommendedMode as PostClassificationResult["recommendedMode"],
        }
      : {
          postType: "unknown" as PostClassificationResult["postType"],
          primaryCategory: "未分類",
          tags: [],
          summary: post.text.substring(0, 100),
          recommendReason: "",
          difficultyLevel: "unknown" as PostClassificationResult["difficultyLevel"],
          thinkingPotentialScore: 50,
          learningPotentialScore: 50,
          outputPotentialScore: 50,
          recommendedMode: "unknown" as PostClassificationResult["recommendedMode"],
        };

    const postText = buildPostTextWithThread(post);
    const provider = getAiProvider();
    let warning: string | null = null;

    const result = await provider
      .generateOutput({
        outputType: outputType as OutputType,
        postText,
        postAuthorName: post.authorName ?? null,
        postAuthorUsername: post.authorUsername ?? null,
        classification,
        steps: [
          {
            title: "学習内容",
            question: "",
            aiContent: card.outputJson,
            userNote: card.userMemo ?? null,
          },
        ],
        userFinalNote: card.userMemo ?? null,
        finalSummary: card.summary,
      })
      .catch((err: unknown) => {
        warning = getUserFacingError(err, "AI生成に失敗したため、下書きを作成しました");
        return createFallbackOutput({
          outputType: outputType as OutputType,
          postText,
          classification,
          userFinalNote: card.userMemo ?? null,
          finalSummary: card.summary,
        });
      });

    // Save to history
    const saved = await prisma.learningCardOutput.create({
      data: {
        learningCardId: cardId,
        outputType,
        title: result.title,
        content: result.content,
        contentJson: result.contentJson ? JSON.stringify(result.contentJson) : null,
      },
    });

    return NextResponse.json({ ...result, id: saved.id, warning });
  } catch (error) {
    console.error("Failed to generate output from learning card:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "アウトプットの生成に失敗しました") },
      { status: 500 }
    );
  }
}
