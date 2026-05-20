import { NextResponse } from "next/server";

function getGrokApiKey(): string | null {
  return process.env.GROK_API_KEY || process.env.XAI_API_KEY || null;
}

function getGrokModel(): string {
  return process.env.GROK_MODEL || process.env.XAI_MODEL || "grok-3";
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
  const apiKey = getGrokApiKey()!;
  const model = getGrokModel();

  // X Articles need the X source; regular URLs use web search
  const isXArticle = X_ARTICLE_RE.test(url);
  const sources = isXArticle
    ? [{ type: "x" }, { type: "web" }]
    : [{ type: "web" }];

  const prompt = isXArticle
    ? `以下のX Article URLの記事を読んで、内容を日本語でまとめてください。\n\n必ず次のJSON形式のみで返してください（説明文不要）:\n{"title":"記事タイトル","description":"150〜250文字の内容まとめ"}\n\nURL: ${url}`
    : `以下のURLの記事を読んで内容を日本語でまとめてください。\n\n必ず次のJSON形式のみで返してください（説明文不要）:\n{"title":"記事タイトル","description":"150〜250文字の内容まとめ"}\n\nURL: ${url}`;

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

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Grok API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || "";

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

    // Fallback: use raw content only if it's not just a URL
    const fallback = content.trim().slice(0, 300);
    return {
      finalUrl: url,
      title: null,
      description: fallback && !isUrlLike(fallback) ? fallback : null,
      image: null,
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl || !/^https?:\/\/.+/.test(rawUrl)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const grokKey = getGrokApiKey();

  try {
    if (grokKey) {
      const result = await fetchWithGrok(rawUrl);
      return NextResponse.json(result);
    } else {
      const result = await fetchWithHtml(rawUrl);
      return NextResponse.json(result);
    }
  } catch (err) {
    // If Grok failed, try HTML fallback before giving up
    if (grokKey) {
      try {
        const result = await fetchWithHtml(rawUrl);
        return NextResponse.json(result);
      } catch {
        // Both failed
      }
    }
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
