import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import {
  createFallbackClassification,
  isWeakClassification,
} from "@/lib/ai/fallback";

// GET /api/posts/[postId]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    let post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        classification: true,
        threadPosts: { orderBy: { threadOrder: "asc" } },
        deepDiveSessions: {
          include: { steps: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    if (!post.classification || isWeakClassification(post.classification)) {
      const fallback = createFallbackClassification({ text: post.text });
      let classification = fallback;

      try {
        classification = await getAiProvider().classifyPost({
          text: post.text,
          authorName: post.authorName,
          authorUsername: post.authorUsername,
        });
      } catch (error) {
        console.error("Post reclassification failed, using fallback:", error);
      }

      await prisma.postClassification.upsert({
        where: { postId },
        create: {
          postId,
          postType: classification.postType,
          primaryCategory: classification.primaryCategory,
          tagsJson: JSON.stringify(classification.tags),
          summary: classification.summary,
          recommendReason: classification.recommendReason,
          difficultyLevel: classification.difficultyLevel,
          outputPotentialScore: classification.outputPotentialScore,
          learningPotentialScore: classification.learningPotentialScore,
          thinkingPotentialScore: classification.thinkingPotentialScore,
          recommendedMode: classification.recommendedMode,
        },
        update: {
          postType: classification.postType,
          primaryCategory: classification.primaryCategory,
          tagsJson: JSON.stringify(classification.tags),
          summary: classification.summary,
          recommendReason: classification.recommendReason,
          difficultyLevel: classification.difficultyLevel,
          outputPotentialScore: classification.outputPotentialScore,
          learningPotentialScore: classification.learningPotentialScore,
          thinkingPotentialScore: classification.thinkingPotentialScore,
          recommendedMode: classification.recommendedMode,
        },
      });

      post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          classification: true,
          threadPosts: { orderBy: { threadOrder: "asc" } },
          deepDiveSessions: {
            include: { steps: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("Failed to fetch post:", error);
    return NextResponse.json({ error: "投稿の取得に失敗しました" }, { status: 500 });
  }
}

// PUT /api/posts/[postId]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const body = await request.json();
    const { text, genre, postType } = body;

    const post = await prisma.post.update({
      where: { id: postId },
      data: { text },
    });

    if (genre || postType) {
      await prisma.postClassification.updateMany({
        where: { postId },
        data: {
          ...(genre && { primaryCategory: genre }),
          ...(postType && { postType }),
        },
      });
    }

    const result = await prisma.post.findUnique({
      where: { id: post.id },
      include: { classification: true },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update post:", error);
    return NextResponse.json({ error: "投稿の更新に失敗しました" }, { status: 500 });
  }
}

// DELETE /api/posts/[postId]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    await prisma.post.delete({ where: { id: postId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return NextResponse.json({ error: "投稿の削除に失敗しました" }, { status: 500 });
  }
}
