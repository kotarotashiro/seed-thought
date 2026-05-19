import { NextResponse } from "next/server";

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    // og:property format
    const og = html.match(
      new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
    ) ?? html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i")
    );
    if (og) return og[1];

    // name= format
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl || !/^https?:\/\/.+/.test(rawUrl)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(rawUrl, {
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
      return NextResponse.json({ finalUrl, title: null, description: null, image: null });
    }

    // Read the response text, but stop once we have the head section
    const fullText = await res.text();
    // Take up to 200KB, enough for any HTML head
    const html = fullText.slice(0, 200_000);

    const title = extractMeta(html, ["og:title"]) ??
      (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null);
    const description = extractMeta(html, ["og:description", "description"]);
    const image = extractMeta(html, ["og:image"]);

    return NextResponse.json({
      finalUrl,
      title: title ? decodeEntities(title) : null,
      description: description ? decodeEntities(description) : null,
      image: image || null,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
