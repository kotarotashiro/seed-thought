import { hasXaiAuthConfigured, xaiChat } from "@/lib/xai/client";

export interface ArticlePreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

function isUrlLike(s: string): boolean {
  return /^https?:\/\/\S+$/.test(s.trim());
}

/**
 * Fetch via Jina Reader (https://r.jina.ai/).
 * Returns the full article body as markdown — much richer than og:description.
 * Free, no auth needed. Unreliable for X posts (login wall) and paywalled sites.
 */
async function fetchWithJina(url: string): Promise<ArticlePreview> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(jinaUrl, {
      headers: { Accept: "text/plain" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`Jina returned ${res.status}`);

    const text = await res.text();
    if (!text || text.length < 100) throw new Error("Jina returned too little content");

    // Jina output format:
    //   Title: <title>
    //   URL Source: <url>
    //   Published Time: <time>
    //   Markdown Content:
    //   # <heading>
    //   <body ...>

    const titleMatch = text.match(/^Title:\s*(.+)$/m);
    let title: string | null = titleMatch ? titleMatch[1].trim() : null;
    // Strip trailing " / X" (Twitter page title suffix)
    if (title) title = title.replace(/\s*\/\s*X\s*$/, "").trim() || null;

    const mdMatch = text.match(/Markdown Content:\s*([\s\S]+)/);
    const body = mdMatch ? mdMatch[1].trim() : text.trim();

    // Detect login wall — treat as failure
    if (/Don't miss what's happening|Log in to X|Sign in to continue|JavaScript is not available/i.test(body.slice(0, 600))) {
      throw new Error("Jina returned login wall");
    }

    const description = body.slice(0, 8_000);
    if (!description) throw new Error("Jina returned empty body");

    return { title, description, imageUrl: null };
  } catch (err) {
    clearTimeout(timer);
    throw err instanceof Error ? err : new Error("Jina fetch failed");
  }
}

async function fetchWithGrok(url: string): Promise<ArticlePreview> {
  const prompt = `以下のURLの記事を読んで内容を日本語でまとめてください。\n\n必ず次のJSON形式のみで返してください（説明文不要）:\n{"title":"記事タイトル","description":"150〜250文字の内容まとめ"}\n\nURL: ${url}`;

  try {
    const { content } = await xaiChat({
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search" }],
    });
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { title?: string; description?: string };
        const title = parsed.title && !isUrlLike(parsed.title) ? parsed.title : null;
        const description = parsed.description && !isUrlLike(parsed.description) ? parsed.description : null;
        if (title || description) {
          return { title, description, imageUrl: null };
        }
      } catch { /* fall through */ }
    }
    const fallback = content.trim().slice(0, 300);
    return { title: null, description: fallback && !isUrlLike(fallback) ? fallback : null, imageUrl: null };
  } catch {
    throw new Error("Grok fetch failed");
  }
}

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const og =
      html.match(new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"));
    if (og) return og[1];
    const nm =
      html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"));
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

async function fetchWithHtml(url: string): Promise<ArticlePreview> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SeedThought/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return { title: null, description: null, imageUrl: null };

    const html = (await res.text()).slice(0, 200_000);
    const rawTitle =
      extractMeta(html, ["og:title"]) ??
      (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null);
    const rawDesc = extractMeta(html, ["og:description", "description"]);
    const image = extractMeta(html, ["og:image"]);

    return {
      title: rawTitle ? decodeEntities(rawTitle) : null,
      description: rawDesc ? decodeEntities(rawDesc) : null,
      imageUrl: image || null,
    };
  } catch {
    clearTimeout(timer);
    throw new Error("HTML fetch failed");
  }
}

/**
 * Fetch article title + description from a URL.
 *
 * Priority:
 *  1. Jina Reader  — full article body as markdown (free, no auth, best for AI input)
 *  2. Grok w/ web_search — AI-generated Japanese summary (handles paywalls, requires xAI config)
 *  3. HTML og:meta — title + og:description only (always available, last resort)
 *
 * Returns null fields on failure (never throws).
 */
export async function fetchArticlePreview(url: string): Promise<ArticlePreview> {
  // 1. Jina — full body, free
  try {
    return await fetchWithJina(url);
  } catch {
    // fall through
  }

  const grokConfigured = await hasXaiAuthConfigured();

  // 2. Grok — AI summary, handles paywalls
  if (grokConfigured) {
    try {
      return await fetchWithGrok(url);
    } catch {
      // fall through
    }
  }

  // 3. HTML og:meta — last resort
  try {
    return await fetchWithHtml(url);
  } catch {
    return { title: null, description: null, imageUrl: null };
  }
}
