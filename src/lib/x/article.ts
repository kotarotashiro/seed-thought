import type { XTweetWithAuthor } from "./client";

export const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;

const URL_IN_TEXT_RE = /https?:\/\/\S+/g;

export function extractXArticleUrl(tweet: XTweetWithAuthor): string | null {
  if (tweet.urlCard?.expandedUrl && X_ARTICLE_RE.test(tweet.urlCard.expandedUrl)) {
    return tweet.urlCard.expandedUrl;
  }

  const urls = tweet.text.match(URL_IN_TEXT_RE) ?? [];
  for (const url of urls) {
    if (X_ARTICLE_RE.test(url)) return url.replace(/[.,;!?)\]]+$/, "");
  }

  return null;
}

export function getXArticleId(url: string): string | null {
  const match = url.match(/\/i\/article\/(\w+)/i);
  return match?.[1] ?? null;
}
