import { fetchArticlePreview } from "@/lib/fetchArticle";
import { parseArticleContent } from "./articleParser";
import { readRelatedLinks } from "./relatedLinks";

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
  const related = readRelatedLinks(urlCardJson);

  // 取得済みリンクの情報を1ブロックに整形（メインの description に追記する用途）
  const relatedBlock = related.length
    ? related
        .filter((l) => l.title || l.description)
        .map((l, i) => {
          const head = l.title ? `${i + 1}. ${l.title}` : `${i + 1}.`;
          const body = l.description ?? "";
          return [head, l.url, body].filter(Boolean).join("\n");
        })
        .join("\n\n")
    : "";

  function withRelated(base: { title?: string; description?: string }) {
    if (!relatedBlock) return base;
    const desc = base.description ? `${base.description}\n\n---\n投稿内リンク情報:\n${relatedBlock}` : `投稿内リンク情報:\n${relatedBlock}`;
    return { title: base.title, description: desc };
  }

  // 1. User-pasted content always wins
  if (card.pastedContent) {
    return withRelated({
      title: card.title || undefined,
      description: card.pastedContent,
    });
  }

  // 2. Existing cached metadata
  if (card.title || card.description) {
    return withRelated({
      title: card.title || undefined,
      description: card.description || undefined,
    });
  }

  // 3. X Articles cannot be fetched — bail out (relatedLinks があれば渡す)
  if (card.isXArticle) {
    return withRelated({});
  }

  // 4. Live fetch for URL-only posts
  const trimmed = (postText || "").trim();
  if (!URL_ONLY_RE.test(trimmed)) return withRelated({});
  try {
    const preview = await fetchArticlePreview(card.expandedUrl ?? trimmed);
    return withRelated({
      title: preview.title || undefined,
      description: preview.description || undefined,
    });
  } catch {
    return withRelated({});
  }
}
