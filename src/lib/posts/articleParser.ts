const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;

export interface ArticleContent {
  expandedUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  pastedContent: string | null;
  pastedByUser: boolean;
  contentQuality: "full" | "summary" | "metadata_only" | null;
  isXArticle: boolean;
}

/** URL追加や記事再取得で、既存の関連リンク・貼り付け本文を壊さずにマージする。 */
export function mergeArticleCardJson(
  existingJson: string | null | undefined,
  incoming: string | Record<string, unknown>,
): string {
  let existing: Record<string, unknown> = {};
  let next: Record<string, unknown> = {};
  try {
    const parsed = existingJson ? JSON.parse(existingJson) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) existing = parsed as Record<string, unknown>;
  } catch {
    existing = {};
  }
  try {
    const parsed = typeof incoming === "string" ? JSON.parse(incoming) : incoming;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) next = parsed as Record<string, unknown>;
  } catch {
    return typeof incoming === "string" ? incoming : JSON.stringify(incoming);
  }
  return JSON.stringify({
    ...existing,
    ...next,
    relatedLinks: Array.isArray(next.relatedLinks)
      ? next.relatedLinks
      : Array.isArray(existing.relatedLinks)
        ? existing.relatedLinks
        : undefined,
  });
}

/**
 * Parse `post.urlCardJson` into a normalized ArticleContent.
 * Returns all-null fields if json is missing/invalid.
 */
export function parseArticleContent(urlCardJson?: string | null): ArticleContent {
  const empty: ArticleContent = {
    expandedUrl: null,
    title: null,
    description: null,
    imageUrl: null,
    pastedContent: null,
    pastedByUser: false,
    contentQuality: null,
    isXArticle: false,
  };
  if (!urlCardJson) return empty;
  try {
    const c = JSON.parse(urlCardJson) as {
      expandedUrl?: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      pastedContent?: string;
      pastedByUser?: boolean;
      contentQuality?: "full" | "summary" | "metadata_only";
    };
    const expandedUrl = c.expandedUrl ?? null;
    const pastedByUser = c.pastedByUser === true;
    return {
      expandedUrl,
      title: c.title ?? null,
      description: c.description ?? null,
      imageUrl: c.imageUrl ?? null,
      pastedContent: pastedByUser && typeof c.pastedContent === "string" ? c.pastedContent : null,
      pastedByUser,
      contentQuality: c.contentQuality ?? null,
      isXArticle: !!expandedUrl && X_ARTICLE_RE.test(expandedUrl),
    };
  } catch {
    return empty;
  }
}
