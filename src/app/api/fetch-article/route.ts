import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai/client";

function hasXaiKey(): boolean {
  return Boolean(process.env.GROK_API_KEY ?? process.env.XAI_API_KEY);
}

interface ArticleResult {
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;

function isUrlLike(s: string): boolean {
  return /^https?:\/\/\S+$/.test(s.trim());
}

async function fetchWithGrok(url: string): Promise<ArticleResult> {
  const isXArticle = X_ARTICLE_RE.test(url);
  const sources = isXArticle ? [{ type: "x" as const }] : [{ type: "web" as const }];

  let prompt: string;
  if (isXArticle) {
    const articleId = url.match(/\/article\/(\d+)/)?.[1] ?? url;
    prompt = `X上のArticle ID「${articleId}」の長文記事を検索して、内容を日本語でまとめてください。\n\n必ず次のJSON形式のみで返してください（説明文不要）:\n{"title":"記事タイトル","description":"150〜250文字の内容まとめ"}`;
  } else {
    prompt = `以下のURLの記事を読んで内容を日本語でまとめてください。\n\n必ず次のJSON形式のみで返してください（説明文不要）:\n{"title":"記事タイトル","description":"150〜250文字の内容まとめ"}\n\nURL: ${url}`;
  }

  const { content } = await xaiChat({
    messages: [{ role: "user", content: prompt }],
    searchParameters: { mode: "on", sources },
  });

  console.log(`[fetch-article] Grok response for ${url}:`, content.slice(0, 500));

  const jsonMatch = content.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { title?: string; description?: string };
      const title = parsed.title && !isUrlLike(parsed.title) ? parsed.title : null;
      const description = parsed.description && !isUrlLike(parsed.description) ? parsed.description : null;
      if (title || description) {
        return { finalUrl: url, title, description, image: null };
      }
    } catch {
      // fall through
    }
  }

  const fallback = content.trim().slice(0, 300);
  const looksUseless =
    !fallback ||
    isUrlLike(fallback) ||
    fallback.startsWith("{") ||
    fallback.startsWith("[") ||
    /^https?:\/\//.test(fallback);
  return {
    finalUrl: url,
    title: null,
    description: looksUseless ? null : fallback,
    image: null,
  };
}

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const og = html.match(
      new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
    ) ?? html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i")
    );
    if (og) return og[1];

    const nm = html.match(
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
    ) ?? html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i")
    );
    if (nm) return nm[1];
  }
  return null;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function fetchWithHtml(url: string): Promise<ArticleResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timer);

    const finalUrl = res.url;
    const contentType = res.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      return { finalUrl, title: null, description: null, image: null };
    }

    const fullText = await res.text();
    const html = fullText.slice(0, 200_000);

    const rawTitle =
      extractMeta(html, ["og:title"]) ??
      (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null);
    const rawDesc = extractMeta(html, ["og:description", "description"]);
    const image = extractMeta(html, ["og:image"]);

    return {
      finalUrl,
      title: rawTitle ? decodeEntities(rawTitle) : null,
      description: rawDesc ? decodeEntities(rawDesc) : null,
      image: image || null,
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function resolveRedirect(rawUrl: string): Promise<string> {
  // Only resolve short-URL hosts to avoid wasteful HEAD calls
  if (!/^https?:\/\/(t\.co|bit\.ly|tinyurl\.com|buff\.ly|ow\.ly)\//i.test(rawUrl)) {
    return rawUrl;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(rawUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SeedThought/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.url || rawUrl;
  } catch {
    return rawUrl;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl || !/^https?:\/\/.+/.test(rawUrl)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Resolve t.co / short URLs to their final destination so the client
  // can identify X Articles and Grok gets the real article URL.
  const resolvedUrl = await resolveRedirect(rawUrl);

  // For X Articles, Grok cannot fetch body content via live search.
  // Skip Grok and return early with the resolved URL so client shows
  // an "open in X" affordance instead of looping on failed fetches.
  if (X_ARTICLE_RE.test(resolvedUrl)) {
    return NextResponse.json({
      finalUrl: resolvedUrl,
      title: null,
      description: null,
      image: null,
      isXArticle: true,
    });
  }

  try {
    if (hasXaiKey()) {
      const result = await fetchWithGrok(resolvedUrl);
      return NextResponse.json({ ...result, finalUrl: resolvedUrl });
    } else {
      const result = await fetchWithHtml(resolvedUrl);
      return NextResponse.json(result);
    }
  } catch (err) {
    if (hasXaiKey()) {
      try {
        const result = await fetchWithHtml(resolvedUrl);
        return NextResponse.json(result);
      } catch {
        // both failed
      }
    }
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: msg, finalUrl: resolvedUrl }, { status: 502 });
  }
}
