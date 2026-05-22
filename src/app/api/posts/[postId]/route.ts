import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import {
  createFallbackClassification,
  isWeakClassification,
} from "@/lib/ai/fallback";
import { needsJapaneseTranslation } from "@/lib/text/language";
import { resolveArticleForAi } from "@/lib/posts/articleContent";

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
        learningCard: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    if (!post.translatedText && needsJapaneseTranslation(post.text)) {
      try {
        const translatedText = await getAiProvider().translateText({ text: post.text });
        post = await prisma.post.update({
          where: { id: postId },
          data: { translatedText },
          include: {
            classification: true,
            threadPosts: { orderBy: { threadOrder: "asc" } },
            learningCard: true,
          },
        });
      } catch (error) {
        console.error("Post translation failed:", error);
      }
    }

    if (!post.classification || isWeakClassification(post.classification)) {
      const fallback = createFallbackClassification({ text: post.text });
      let classification = fallback;

      // Pull article body (pasted or fetched) so AI classifies the actual
      // article content rather than the bare URL.
      const { description: articleContent } = await resolveArticleForAi(
        post.urlCardJson,
        post.text,
      );

      try {
        classification = await getAiProvider().classifyPost({
          text: post.text,
          authorName: post.authorName,
          authorUsername: post.authorUsername,
          articleContent,
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
          learningCard: true,
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

// PATCH /api/posts/[postId]
// Partial update — supports: urlCardJson, videoTranscriptText
// When urlCardJson is updated with newly-pasted article content, the post's
// classification is cleared so the next GET reclassifies using the article
// body (rather than the bare URL, which usually classifies as 不明).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const body = (await request.json()) as { urlCardJson?: string; videoTranscriptText?: string | null };
    if (body.urlCardJson === undefined && body.videoTranscriptText === undefined) {
      return NextResponse.json({ error: "更新するフィールドがありません" }, { status: 400 });
    }

    const updateData: { urlCardJson?: string; videoTranscriptText?: string | null } = {};

    let hasNewPastedContent = false;
    if (body.urlCardJson !== undefined) {
      updateData.urlCardJson = body.urlCardJson;
      try {
        const incoming = JSON.parse(body.urlCardJson) as { pastedByUser?: boolean; pastedContent?: string };
        if (incoming.pastedByUser && typeof incoming.pastedContent === "string" && incoming.pastedContent.trim().length > 0) {
          hasNewPastedContent = true;
        }
      } catch { /* invalid JSON — fall through */ }
    }

    if (body.videoTranscriptText !== undefined) {
      updateData.videoTranscriptText = body.videoTranscriptText;
    }

    await prisma.post.update({
      where: { id: postId },
      data: updateData,
    });

    if (hasNewPastedContent) {
      await prisma.postClassification.deleteMany({ where: { postId } });
    }

    return NextResponse.json({ success: true, reclassifyOnNextGet: hasNewPastedContent });
  } catch (error) {
    console.error("Failed to patch post:", error);
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
