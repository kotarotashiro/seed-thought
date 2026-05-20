import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { SourcePostForLearning } from "@/lib/ai/types";
import { getUserFacingError } from "@/lib/api/errors";
import { buildPostTextWithThread } from "@/lib/posts/threadText";
import { fetchArticlePreview } from "@/lib/fetchArticle";

type RawMediaItem = {
  type?: unknown;
  url?: unknown;
  previewUrl?: unknown;
  thumbnailUrl?: unknown;
  altText?: unknown;
};

function parseTags(tagsJson?: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const tags = JSON.parse(tagsJson);
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function parseMedia(mediaJson?: string | null): SourcePostForLearning["media"] {
  if (!mediaJson) return [];
  try {
    const media = JSON.parse(mediaJson);
    if (!Array.isArray(media)) return [];

    const parsed: SourcePostForLearning["media"] = [];
    media.forEach((item: RawMediaItem) => {
      if (!item || typeof item !== "object") return;
      const type =
        item.type === "photo"
          ? "image"
          : item.type === "video"
          ? "video"
          : item.type === "animated_gif"
          ? "gif"
          : null;
      const url = typeof item.url === "string" ? item.url : null;
      const thumbnailUrl =
        typeof item.previewUrl === "string"
          ? item.previewUrl
          : typeof item.thumbnailUrl === "string"
          ? item.thumbnailUrl
          : undefined;

      if (!type || (!url && !thumbnailUrl)) return;
      parsed.push({
        type,
        url: url || thumbnailUrl || "",
        thumbnailUrl,
        altText: typeof item.altText === "string" ? item.altText : undefined,
      });
    });
    return parsed;
  } catch {
    return [];
  }
}

async function getPostForLearning(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      classification: true,
      threadPosts: { orderBy: { threadOrder: "asc" } },
      learningCard: true,
    },
  });
}

function parseUrlCard(urlCardJson?: string | null): { title?: string; description?: string } {
  if (!urlCardJson) return {};
  try {
    const c = JSON.parse(urlCardJson) as { title?: string; description?: string };
    return { title: c.title || undefined, description: c.description || undefined };
  } catch {
    return {};
  }
}

async function buildSourcePost(
  post: NonNullable<Awaited<ReturnType<typeof getPostForLearning>>>
): Promise<SourcePostForLearning> {
  const threadMedia = post.threadPosts.flatMap((threadPost) => parseMedia(threadPost.mediaJson));

  // For URL-only posts, try to get article content for richer AI analysis
  const isUrlOnly = /^https?:\/\/\S+$/.test((post.text || "").trim());
  let articleTitle: string | undefined;
  let articleDescription: string | undefined;

  const urlCard = parseUrlCard(post.urlCardJson);
  if (urlCard.title) {
    articleTitle = urlCard.title;
    articleDescription = urlCard.description;
  } else if (isUrlOnly) {
    const url = post.text.trim();
    try {
      const preview = await fetchArticlePreview(url);
      articleTitle = preview.title || undefined;
      articleDescription = preview.description || undefined;
    } catch {
      // silently skip — AI will work with what it has
    }
  }

  return {
    id: post.id,
    authorName: post.authorName || "手動追加",
    authorHandle: post.authorUsername || "",
    text: buildPostTextWithThread(post),
    translatedText: post.translatedText || undefined,
    postUrl: post.sourceUrl || "",
    postedAt: post.postedAt?.toISOString(),
    media: [...parseMedia(post.mediaJson), ...threadMedia],
    tags: parseTags(post.classification?.tagsJson),
    genre: post.classification?.primaryCategory,
    type: post.classification?.postType,
    existingSummary: post.classification?.summary,
    userMemo: post.learningCard?.userMemo || undefined,
    articleTitle,
    articleDescription,
  };
}

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

    return NextResponse.json({ post, learningCard: post.learningCard });
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
    const post = await getPostForLearning(postId);
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    const output = await getAiProvider().generateLearningCard(await buildSourcePost(post));
    const draftOutput = { ...output, sourcePostId: post.id, status: "draft" as const };

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
      },
    });

    return NextResponse.json({ learningCard, output: draftOutput }, { status: 201 });
  } catch (error) {
    console.error("Failed to generate learning card:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "学習カードの生成に失敗しました") },
      { status: 500 }
    );
  }
}
