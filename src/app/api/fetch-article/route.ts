import { NextResponse } from "next/server";

function parseMetaTag(html: string, attrs: string[][]): string | null {
  for (const [attrName, attrValue] of attrs) {
    const patterns = [
      new RegExp(`<meta[^>]+${attrName}=["']${attrValue}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${attrValue}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) return m[1];
    }
  }
  return null;
}

function parseTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  if (!/^https?:\/\/.+/.test(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SeedThought/1.0; +https://seed-thought.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    const finalUrl = res.url;
    const contentType = res.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      return NextResponse.json({ finalUrl, title: null, description: null, image: null });
    }

    // Only read first 100KB to avoid huge responses
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < 100_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytes += value.length;
        // Stop once we have the <head> section
        if (html.includes("</head>")) break;
      }
      reader.cancel();
    }

    const ogTitle = parseMetaTag(html, [["property", "og:title"], ["name", "og:title"]]);
    const ogDesc = parseMetaTag(html, [
      ["property", "og:description"],
      ["name", "og:description"],
      ["name", "description"],
    ]);
    const ogImage = parseMetaTag(html, [["property", "og:image"], ["name", "og:image"]]);
    const title = ogTitle || parseTitle(html);

    return NextResponse.json({
      finalUrl,
      title: title ? decodeHtmlEntities(title) : null,
      description: ogDesc ? decodeHtmlEntities(ogDesc) : null,
      image: ogImage || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
