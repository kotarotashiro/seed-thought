const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;

export interface ArticleContent {
  expandedUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  pastedContent: string | null;
  pastedByUser: boolean;
  isXArticle: boolean;
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
      isXArticle: !!expandedUrl && X_ARTICLE_RE.test(expandedUrl),
    };
  } catch {
    return empty;
  }
}
