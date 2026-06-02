import { prisma } from "@/lib/db/prisma";
import type { SourcePostForLearning } from "@/lib/ai/types";
import { buildPostTextWithThread } from "@/lib/posts/threadText";
import { resolveArticleForAi } from "@/lib/posts/articleContent";

type RawMediaItem = {
  type?: unknown;
  url?: unknown;
  previewUrl?: unknown;
  thumbnailUrl?: unknown;
  altText?: unknown;
  description?: unknown;
};

export function parseTags(tagsJson?: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const tags = JSON.parse(tagsJson);
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

export function parseMedia(mediaJson?: string | null): SourcePostForLearning["media"] {
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
        description: typeof item.description === "string" ? item.description : undefined,
      });
    });
    return parsed;
  } catch {
    return [];
  }
}

export async function getPostForLearning(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      classification: true,
      threadPosts: { orderBy: { threadOrder: "asc" } },
      learningCard: true,
    },
  });
}

export type PostForLearning = NonNullable<Awaited<ReturnType<typeof getPostForLearning>>>;

export async function buildSourcePost(
  post: PostForLearning
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
    videoTranscript: post.videoTranscriptText || undefined,
  };
}
