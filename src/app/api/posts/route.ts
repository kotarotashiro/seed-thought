import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { Prisma } from "@/generated/prisma/client";
import { createFallbackClassification } from "@/lib/ai/fallback";

const sortOptions = {
  savedAt_desc: { savedAt: "desc" },
  savedAt_asc: { savedAt: "asc" },
  postedAt_desc: { postedAt: { sort: "desc", nulls: "last" } },
  postedAt_asc: { postedAt: { sort: "asc", nulls: "last" } },
} satisfies Record<string, Prisma.PostOrderByWithRelationInput>;

function getPostOrderBy(sort: string): Prisma.PostOrderByWithRelationInput {
  if (sort in sortOptions) {
    return sortOptions[sort as keyof typeof sortOptions];
  }
  return sortOptions.postedAt_desc;
}

// GET /api/posts - List all posts with filters
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const genre = searchParams.get("genre") || "";
  const postType = searchParams.get("postType") || "";
  const savedType = searchParams.get("savedType") || "";
  const digestStatus = searchParams.get("digestStatus") || "";
  const sort = searchParams.get("sort") || "postedAt_desc";

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.text = { contains: search };
    }
    if (savedType) {
      where.savedType = savedType;
    }
    if (genre || postType) {
      where.classification = {};
      if (genre) where.classification.primaryCategory = genre;
      if (postType) where.classification.postType = postType;
    }
    if (digestStatus === "undigested") {
      where.deepDiveSessions = { none: {} };
    } else if (digestStatus === "digested") {
      where.deepDiveSessions = { some: {} };
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        classification: true,
        threadPosts: { select: { id: true } },
        deepDiveSessions: { select: { id: true, status: true } },
      },
      orderBy: [
        getPostOrderBy(sort),
        { savedAt: "desc" },
      ],
    });

    const genres = await prisma.postClassification.findMany({
      select: { primaryCategory: true },
      distinct: ["primaryCategory"],
    });

    return NextResponse.json({
      posts,
      genres: genres.map((g) => g.primaryCategory),
    });
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    return NextResponse.json({ error: "投稿の取得に失敗しました" }, { status: 500 });
  }
}

// DELETE /api/posts - Bulk delete posts
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "削除するIDを指定してください" }, { status: 400 });
    }
    await prisma.post.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Failed to bulk delete posts:", error);
    return NextResponse.json({ error: "投稿の削除に失敗しました" }, { status: 500 });
  }
}

// POST /api/posts - Create a new post manually
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, genre, postType: inputPostType } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "投稿本文を入力してください" }, { status: 400 });
    }

    // Create the post
    const post = await prisma.post.create({
      data: {
        source: "manual",
        savedType: "manual",
        text: text.trim(),
        savedAt: new Date(),
      },
    });

    // Attempt AI classification
    try {
      const provider = getAiProvider();
      const classification = await provider.classifyPost({ text: text.trim() });

      await prisma.postClassification.create({
        data: {
          postId: post.id,
          postType: inputPostType || classification.postType,
          primaryCategory: genre || classification.primaryCategory,
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
    } catch (error) {
      console.error("Manual post classification failed, using fallback:", error);
      const classification = createFallbackClassification({ text: text.trim() });
      await prisma.postClassification.create({
        data: {
          postId: post.id,
          postType: inputPostType || classification.postType,
          primaryCategory: genre || classification.primaryCategory,
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
    }

    const result = await prisma.post.findUnique({
      where: { id: post.id },
      include: { classification: true },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create post:", error);
    return NextResponse.json({ error: "投稿の保存に失敗しました" }, { status: 500 });
  }
}
