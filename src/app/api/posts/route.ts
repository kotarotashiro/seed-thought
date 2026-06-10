import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { Prisma } from "@/generated/prisma/client";
import { createFallbackClassification } from "@/lib/ai/fallback";

// 投稿分類・翻訳のLLM呼び出し。Vercel Hobby(Fluid Compute)上限の300秒まで引き上げ、
// Kimi等の遅いモデルでも打ち切られないようにする。
export const maxDuration = 300;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Extension-Token",
};

function corsJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

function isExtensionAuthorized(request: Request): boolean {
  const expected = process.env.EXTENSION_TOKEN;
  if (!expected) {
    // REQUIRE_EXTENSION_TOKEN=1 を設定すると、EXTENSION_TOKEN未設定時に全リクエストを拒否する。
    // Cloudflare Tunnelなど外部公開環境ではこのフラグを有効にしてEXTENSION_TOKENも設定すること。
    if (process.env.REQUIRE_EXTENSION_TOKEN === "1") return false;
    return true; // 未設定=オープン（個人ローカル利用デフォルト）
  }
  const header = request.headers.get("x-extension-token") || "";
  return header === expected;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// X API は「いいねした日時」を返さないため、投稿日時(postedAt) を「いいねした日」の
// 代理値として使う（リアルタイムでいいねする使い方なら近似として十分機能する）。
// likedAt_* は postedAt_* のエイリアス。
const sortOptions = {
  likedAt_desc: { postedAt: { sort: "desc", nulls: "last" } },
  likedAt_asc: { postedAt: { sort: "asc", nulls: "last" } },
  savedAt_desc: { savedAt: "desc" },
  savedAt_asc: { savedAt: "asc" },
  postedAt_desc: { postedAt: { sort: "desc", nulls: "last" } },
  postedAt_asc: { postedAt: { sort: "asc", nulls: "last" } },
} satisfies Record<string, Prisma.PostOrderByWithRelationInput>;

function getPostOrderBy(sort: string): Prisma.PostOrderByWithRelationInput {
  if (sort in sortOptions) {
    return sortOptions[sort as keyof typeof sortOptions];
  }
  return sortOptions.likedAt_desc;
}

// GET /api/posts - List all posts with filters (cursor-based pagination)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const genre = searchParams.get("genre") || "";
  const postType = searchParams.get("postType") || "";
  const savedType = searchParams.get("savedType") || "";
  const source = searchParams.get("source") || "";
  const digestStatus = searchParams.get("digestStatus") || "";
  const author = searchParams.get("author") || "";
  const sort = searchParams.get("sort") || "likedAt_desc";
  const cursor = searchParams.get("cursor") || "";

  const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
  const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50);

  const isFirstPage = !cursor;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.text = { contains: search };
    }
    if (savedType) {
      where.savedType = savedType;
    }
    if (source) {
      where.source = source;
    }
    if (author) {
      where.authorUsername = author;
    }
    if (genre || postType) {
      where.classification = {};
      if (genre) where.classification.primaryCategory = genre;
      if (postType) where.classification.postType = postType;
    }
    if (digestStatus === "undigested") {
      where.learningCard = null;
    } else if (digestStatus === "digested") {
      where.learningCard = { isNot: null };
    }

    const rows = await prisma.post.findMany({
      where,
      include: {
        classification: true,
        threadPosts: { select: { id: true } },
        learningCard: { select: { id: true, status: true } },
      },
      orderBy: [
        getPostOrderBy(sort),
        { savedAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasNextPage = rows.length > limit;
    const posts = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? posts[posts.length - 1].id : null;

    // genres and authors are expensive distinct queries — only compute on first page
    let genres: string[] = [];
    let authors: { username: string; name: string | null }[] = [];
    if (isFirstPage) {
      const genreRows = await prisma.postClassification.findMany({
        select: { primaryCategory: true },
        distinct: ["primaryCategory"],
      });
      const authorRows = await prisma.post.findMany({
        where: { authorUsername: { not: null } },
        select: { authorUsername: true, authorName: true },
        distinct: ["authorUsername"],
        orderBy: { authorUsername: "asc" },
      });
      genres = genreRows.map((g) => g.primaryCategory);
      authors = authorRows
        .filter((a) => a.authorUsername)
        .map((a) => ({ username: a.authorUsername!, name: a.authorName }));
    }

    return NextResponse.json({ posts, nextCursor, genres, authors });
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

// POST /api/posts - Create a new post manually OR via browser extension.
// Extension submissions include source="web" and a sourceUrl. They are stored
// as manual-style posts and run through the same classification pipeline.
export async function POST(request: Request) {
  if (!isExtensionAuthorized(request)) {
    return corsJson({ error: "認証されていません" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      text,
      genre,
      postType: inputPostType,
      source,
      sourceUrl,
      title,
      content,
      authorName,
      authorUsername,
    } = body as {
      text?: string;
      genre?: string;
      postType?: string;
      source?: string;
      sourceUrl?: string;
      title?: string;
      content?: string;
      authorName?: string;
      authorUsername?: string;
    };

    const isWeb = source === "web";

    // For web submissions, build a "text" body that includes title + URL so the
    // classifier sees something coherent even when the user clipped a long page.
    const effectiveText = (() => {
      if (text && typeof text === "string" && text.trim().length > 0) return text.trim();
      if (isWeb) {
        const parts: string[] = [];
        if (title) parts.push(title);
        if (sourceUrl) parts.push(sourceUrl);
        if (content) parts.push(content);
        const joined = parts.join("\n\n").trim();
        return joined.length > 0 ? joined : null;
      }
      return null;
    })();

    if (!effectiveText) {
      return corsJson({ error: "投稿本文を入力してください" }, { status: 400 });
    }

    // For web submissions we keep the article body in urlCardJson so existing
    // article-aware classification / learning prompts pick it up.
    const urlCardJson = isWeb && sourceUrl
      ? JSON.stringify({
          expandedUrl: sourceUrl,
          title: title || null,
          description: content ? content.slice(0, 300) : null,
          pastedContent: content || null,
          pastedByUser: Boolean(content),
        })
      : null;

    // Create the post
    const post = await prisma.post.create({
      data: {
        source: "user_manual",
        savedType: "manual",
        text: effectiveText,
        sourceUrl: isWeb ? sourceUrl ?? null : null,
        authorName: authorName ?? (isWeb && sourceUrl ? hostnameOf(sourceUrl) : null),
        authorUsername: authorUsername ?? null,
        urlCardJson,
        savedAt: new Date(),
      },
    });

    // Attempt AI classification
    try {
      const provider = getAiProvider();
      const classification = await provider.classifyPost({
        text: effectiveText,
        articleContent: isWeb ? content : undefined,
      });

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
      const classification = createFallbackClassification({ text: effectiveText });
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

    return corsJson(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create post:", error);
    return corsJson({ error: "投稿の保存に失敗しました" }, { status: 500 });
  }
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
