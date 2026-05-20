import { fetchArticlePreview } from "@/lib/fetchArticle";

const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;
const URL_ONLY_RE = /^https?:\/\/\S+$/;

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

/**
 * Resolve the best `{ title, description }` to feed to AI prompts for a post.
 *
 * Priority order:
 *  1. User-pasted article body (always wins — most reliable)
 *  2. Cached title/description in urlCardJson (from X API sync or earlier fetch)
 *  3. Live fetch via Grok / HTML scraping (only when post text is a single URL
 *     AND it's not an X Article — those require user paste)
 */
export async function resolveArticleForAi(
  urlCardJson: string | null | undefined,
  postText: string
): Promise<{ title?: string; description?: string }> {
  const card = parseArticleContent(urlCardJson);

  // 1. User-pasted content always wins
  if (card.pastedContent) {
    return {
      title: card.title || undefined,
      description: card.pastedContent,
    };
  }

  // 2. Existing cached metadata
  if (card.title || card.description) {
    return {
      title: card.title || undefined,
      description: card.description || undefined,
    };
  }

  // 3. X Articles cannot be fetched — bail out
  if (card.isXArticle) {
    return {};
  }

  // 4. Live fetch for URL-only posts
  const trimmed = (postText || "").trim();
  if (!URL_ONLY_RE.test(trimmed)) return {};
  try {
    const preview = await fetchArticlePreview(card.expandedUrl ?? trimmed);
    return {
      title: preview.title || undefined,
      description: preview.description || undefined,
    };
  } catch {
    return {};
  }
}
