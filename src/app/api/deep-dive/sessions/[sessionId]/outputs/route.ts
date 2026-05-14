import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import { getUserFacingError } from "@/lib/api/errors";
import type { PostClassificationResult } from "@/lib/ai/types";

// POST /api/deep-dive/sessions/[sessionId]/outputs - Generate output
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const body = await request.json();
    const { outputType } = body;

    if (!outputType) {
      return NextResponse.json(
        { error: "outputType が必要です" },
        { status: 400 }
      );
    }

    // Get the session with all related data
    const session = await prisma.deepDiveSession.findUnique({
      where: { id: sessionId },
      include: {
        post: { include: { classification: true } },
        steps: { orderBy: { stepIndex: "asc" } },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    const classification: PostClassificationResult = session.post.classification
      ? {
          postType: session.post.classification.postType as PostClassificationResult["postType"],
          primaryCategory: session.post.classification.primaryCategory,
          tags: JSON.parse(session.post.classification.tagsJson || "[]"),
          summary: session.post.classification.summary,
          recommendReason: session.post.classification.recommendReason,
          difficultyLevel: session.post.classification.difficultyLevel as PostClassificationResult["difficultyLevel"],
          thinkingPotentialScore: session.post.classification.thinkingPotentialScore,
          learningPotentialScore: session.post.classification.learningPotentialScore,
          outputPotentialScore: session.post.classification.outputPotentialScore,
          recommendedMode: session.post.classification.recommendedMode as PostClassificationResult["recommendedMode"],
        }
      : {
          postType: "unknown",
          primaryCategory: "未分類",
          tags: [],
          summary: session.post.text.substring(0, 100),
          recommendReason: "",
          difficultyLevel: "unknown",
          thinkingPotentialScore: 50,
          learningPotentialScore: 50,
          outputPotentialScore: 50,
          recommendedMode: "unknown",
        };

    const provider = getAiProvider();
    const result = await provider.generateOutput({
      outputType,
      postText: session.post.text,
      classification,
      steps: session.steps.map((s) => ({
        title: s.title,
        question: s.question,
        aiContent: s.aiContentJson,
        userNote: s.userNote,
      })),
      userFinalNote: session.userFinalNote,
      finalSummary: session.finalSummary,
    });

    // Save the output
    const output = await prisma.generatedOutput.create({
      data: {
        sessionId,
        outputType,
        title: result.title,
        content: result.content,
        contentJson: result.contentJson ? JSON.stringify(result.contentJson) : null,
        status: "draft",
      },
    });

    return NextResponse.json({
      ...output,
      contentJson: result.contentJson || null,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to generate output:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "アウトプットの生成に失敗しました") },
      { status: 500 }
    );
  }
}
