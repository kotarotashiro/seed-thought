export interface ArticlePreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

function getGrokApiKey(): string | null {
  return process.env.GROK_API_KEY || process.env.XAI_API_KEY || null;
}

function getGrokModel(): string {
  return process.env.GROK_MODEL || process.env.XAI_MODEL || "grok-3";
}

const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;

function isUrlLike(s: string): boolean {
  return /^https?:\/\/\S+$/.test(s.trim());
}

async function fetchWithGrok(url: string): Promise<ArticlePreview> {
  const apiKey = getGrokApiKey()!;
  const model = getGrokModel();

  const isXArticle = X_ARTICLE_RE.test(url);
  const sources = isXArticle
    ? [{ type: "x" }]
    : [{ type: "web" }];

  let prompt: string;
  if (isXArticle) {
    const articleId = url.match(/\/article\/(\d+)/)?.[1] ?? url;
    prompt = `X上のArticle ID「${articleId}」の長文記事を検索して、内容を日本語でまとめてください。\n\n必ず次のJSON形式のみで返してください（説明文不要）:\n{"title":"記事タイトル","description":"150〜250文字の内容まとめ"}`;
  } else {
    prompt = `以下のURLの記事を読んで内容を日本語でまとめてください。\n\n必ず次のJSON形式のみで返してください（説明文不要）:\n{"title":"記事タイトル","description":"150〜250文字の内容まとめ"}\n\nURL: ${url}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        search_parameters: { mode: "on", sources },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Grok API ${res.status}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
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
    clearTimeout(timer);
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
 * Uses Grok with live search if available, falls back to HTML scraping.
 * Returns null fields on failure (never throws).
 */
export async function fetchArticlePreview(url: string): Promise<ArticlePreview> {
  const grokKey = getGrokApiKey();

  try {
    if (grokKey) {
      return await fetchWithGrok(url);
    }
    return await fetchWithHtml(url);
  } catch {
    if (grokKey) {
      try {
        return await fetchWithHtml(url);
      } catch {
        // both failed
      }
    }
    return { title: null, description: null, imageUrl: null };
  }
}
