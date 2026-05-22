import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { SourcePostForLearning } from "@/lib/ai/types";
import { getUserFacingError } from "@/lib/api/errors";
import { buildPostTextWithThread } from "@/lib/posts/threadText";
import { resolveArticleForAi } from "@/lib/posts/articleContent";

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

async function buildSourcePost(
  post: NonNullable<Awaited<ReturnType<typeof getPostForLearning>>>
): Promise<Omit<SourcePostForLearning, "learningMode">> {
  const threadMedia = post.threadPosts.flatMap((threadPost) => parseMedia(threadPost.mediaJson));

  const { title: articleTitle, description: articleDescription } = await resolveArticleForAi(
    post.urlCardJson,
    post.text,
  );

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

    const [learningOutput, strictLearningOutput] = await Promise.all([
      getAiProvider().generateLearningCard(sourceWithMode),
      getAiProvider().generateStrictLearning({
        postText: sourceWithMode.text,
        classification: {
          primaryCategory: post.classification?.primaryCategory || "",
          summary: post.classification?.summary || "",
        },
        userMemo: post.learningCard?.userMemo ?? null,
      }),
    ]);

    const draftOutput = { ...learningOutput, sourcePostId: post.id, status: "draft" as const };

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
        strictLearningJson: JSON.stringify(strictLearningOutput),
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
        strictLearningJson: JSON.stringify(strictLearningOutput),
      },
    });

    return NextResponse.json(
      { learningCard, output: draftOutput, strictLearning: strictLearningOutput },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to generate learning card:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "学習カードの生成に失敗しました") },
      { status: 500 }
    );
  }
}
