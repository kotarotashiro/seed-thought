import { fetchArticlePreview } from "@/lib/fetchArticle";
import { parseArticleContent } from "./articleParser";

const URL_ONLY_RE = /^https?:\/\/\S+$/;

export { parseArticleContent } from "./articleParser";

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
