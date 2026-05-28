import { prisma } from "@/lib/db/prisma";
import { fetchArticlePreview } from "@/lib/fetchArticle";
import { parseArticleContent } from "./articleParser";

const URL_RE = /https?:\/\/[^\s)>"'】]+/gi;
const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;

export interface RelatedLink {
  url: string;
  finalUrl?: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  fetchedAt: string;
}

function normalizeUrl(raw: string): string {
  return raw.replace(/[).,;:'"]+$/, "");
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export async function gatherUrlsFromPost(postId: string): Promise<string[]> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      text: true,
      urlCardJson: true,
      threadPosts: { select: { text: true } },
    },
  });
  if (!post) return [];

  const card = parseArticleContent(post.urlCardJson);
  const mainUrl = card.expandedUrl ? card.expandedUrl : null;

  const rawUrls: string[] = [];
  const allText = [post.text, ...post.threadPosts.map((t) => t.text)].join("\n");
  const matches = allText.match(URL_RE) ?? [];
  for (const m of matches) {
    rawUrls.push(normalizeUrl(m));
  }

  // メインの urlCardJson に同じURLが既に展開されていたら除外
  const filtered = unique(rawUrls).filter((u) => {
    if (!u) return false;
    // X Article は外からは取れない
    if (X_ARTICLE_RE.test(u)) return false;
    // t.co のような未解決ショートURLは fetchArticlePreview 側で展開される
    if (mainUrl && (u === mainUrl)) return false;
    return true;
  });

  return filtered;
}

/**
 * 投稿テキスト(本体+ツリー)に含まれる全URLを fetch して urlCardJson.relatedLinks に保存する。
 * 1投稿あたり最大 max 件まで。既存の main urlCardJson は触らない。
 */
export async function enrichPostRelatedLinks(
  postId: string,
  options: { max?: number; force?: boolean } = {}
): Promise<{ links: RelatedLink[]; fetchedCount: number; skippedCount: number }> {
  const max = options.max ?? 6;

  const urls = await gatherUrlsFromPost(postId);
  if (urls.length === 0) {
    return { links: [], fetchedCount: 0, skippedCount: 0 };
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { urlCardJson: true },
  });
  if (!post) throw new Error("投稿が見つかりません");

  // 既存の relatedLinks を読み込む
  let existingCard: Record<string, unknown> = {};
  try {
    existingCard = post.urlCardJson ? JSON.parse(post.urlCardJson) : {};
  } catch {
    existingCard = {};
  }
  const existingLinks: RelatedLink[] = Array.isArray(
    (existingCard as { relatedLinks?: RelatedLink[] }).relatedLinks
  )
    ? ((existingCard as { relatedLinks: RelatedLink[] }).relatedLinks)
    : [];

  const knownUrls = new Set(existingLinks.map((l) => l.url));
  const targets = urls.filter((u) => options.force || !knownUrls.has(u)).slice(0, max);

  if (targets.length === 0) {
    return { links: existingLinks, fetchedCount: 0, skippedCount: urls.length };
  }

  // URLごとの fetch を並列実行。1件あたり Grok 経由で 10〜25s かかるため、
  // 直列にするとサーバ側で 1分以上ブロックされて Vercel/Edge のタイムアウトに
  // 引っかかる。allSettled で失敗 URL は単にスキップする。
  const results = await Promise.allSettled(
    targets.map((url) => fetchArticlePreview(url))
  );
  const fetched: RelatedLink[] = [];
  results.forEach((r, i) => {
    const url = targets[i];
    if (r.status === "fulfilled") {
      fetched.push({
        url,
        title: r.value.title,
        description: r.value.description,
        imageUrl: r.value.imageUrl,
        fetchedAt: new Date().toISOString(),
      });
    } else {
      console.warn(`[relatedLinks] failed to fetch ${url}:`, r.reason);
    }
  });

  // 既存(優先) + 新規 をマージ
  const merged: RelatedLink[] = [
    ...existingLinks,
    ...fetched.filter((f) => !knownUrls.has(f.url)),
  ];

  const updated = JSON.stringify({ ...existingCard, relatedLinks: merged });
  await prisma.post.update({
    where: { id: postId },
    data: { urlCardJson: updated },
  });

  return { links: merged, fetchedCount: fetched.length, skippedCount: urls.length - targets.length };
}

/**
 * 既存の urlCardJson から relatedLinks を取り出す。読み取り専用。
 */
export function readRelatedLinks(urlCardJson: string | null | undefined): RelatedLink[] {
  if (!urlCardJson) return [];
  try {
    const c = JSON.parse(urlCardJson) as { relatedLinks?: RelatedLink[] };
    return Array.isArray(c.relatedLinks) ? c.relatedLinks : [];
  } catch {
    return [];
  }
}
