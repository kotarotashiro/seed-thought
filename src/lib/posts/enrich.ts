import { prisma } from "@/lib/db/prisma";
import { fetchArticlePreview } from "@/lib/fetchArticle";
import { parseArticleContent } from "./articleContent";

const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;
const URL_ONLY_RE = /^https?:\/\/\S+$/;

// Returns true if this post has a fetchable external URL (not X Article, not already enriched).
function needsEnrichment(post: {
  urlCardJson: string | null;
  text: string;
  enrichmentStatus: string;
}): boolean {
  if (post.enrichmentStatus === "done" || post.enrichmentStatus === "processing") return false;

  const card = parseArticleContent(post.urlCardJson);
  if (card.pastedContent) return false; // already has content
  if (card.isXArticle) return false;    // X Articles can't be fetched via API

  const hasUrlCard = Boolean(card.expandedUrl);
  const textIsUrl = URL_ONLY_RE.test(post.text.trim());
  return hasUrlCard || textIsUrl;
}

async function enrichOne(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, urlCardJson: true, text: true, enrichmentStatus: true },
  });
  if (!post || !needsEnrichment(post)) return;

  await prisma.post.update({
    where: { id: postId },
    data: { enrichmentStatus: "processing" },
  });

  const card = parseArticleContent(post.urlCardJson);
  const url = card.expandedUrl ?? (URL_ONLY_RE.test(post.text.trim()) ? post.text.trim() : null);
  if (!url || X_ARTICLE_RE.test(url)) {
    await prisma.post.update({ where: { id: postId }, data: { enrichmentStatus: "done" } });
    return;
  }

  try {
    const preview = await fetchArticlePreview(url);

    if (preview.title || preview.description) {
      const updated = JSON.stringify({
        expandedUrl: card.expandedUrl ?? url,
        title: preview.title ?? card.title,
        description: preview.description ?? card.description,
        imageUrl: preview.imageUrl ?? card.imageUrl,
        pastedByUser: false,
      });
      await prisma.post.update({
        where: { id: postId },
        data: { urlCardJson: updated, enrichmentStatus: "done" },
      });
    } else {
      await prisma.post.update({ where: { id: postId }, data: { enrichmentStatus: "done" } });
    }
  } catch {
    await prisma.post.update({ where: { id: postId }, data: { enrichmentStatus: "failed" } });
  }
}

// Process a batch of pending/failed posts. Called from cron or after().
export async function enrichPendingPosts(limit = 10): Promise<void> {
  const posts = await prisma.post.findMany({
    where: { enrichmentStatus: { in: ["pending", "failed"] } },
    select: { id: true, urlCardJson: true, text: true, enrichmentStatus: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const toProcess = posts.filter(needsEnrichment);
  for (const post of toProcess) {
    await enrichOne(post.id);
  }
}

// Mark a newly-created post for enrichment if it has a fetchable URL.
export function markForEnrichment(post: {
  id: string;
  urlCardJson: string | null;
  text: string;
  enrichmentStatus: string;
}): boolean {
  return needsEnrichment(post);
}
