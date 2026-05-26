import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { X_ARTICLE_RE } from "@/lib/x/article";
import { parseArticleContent } from "@/lib/posts/articleContent";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-extension-token",
  "Access-Control-Max-Age": "86400",
};

function withCors<T>(body: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  });
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.EXTENSION_TOKEN;
  if (!expected) return true;
  return (request.headers.get("x-extension-token") ?? "") === expected;
}

function findArticleUrl(urlCardJson: string | null, text: string): string | null {
  const card = parseArticleContent(urlCardJson);
  if (card.expandedUrl && X_ARTICLE_RE.test(card.expandedUrl)) return card.expandedUrl;
  const match = text.match(/https?:\/\/\S+/g) ?? [];
  for (const url of match) {
    if (X_ARTICLE_RE.test(url)) return url.replace(/[.,;!?)\]]+$/, "");
  }
  return null;
}

function getArticleIdFromUrl(url: string): string | null {
  const m = url.match(/\/i\/article\/(\d+)/i);
  return m?.[1] ?? null;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return withCors({ error: "認証されていません" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 50);

  const posts = await prisma.post.findMany({
    where: { enrichmentStatus: "x_article_pending" },
    select: { id: true, urlCardJson: true, text: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const items = posts.flatMap((post) => {
    const articleUrl = findArticleUrl(post.urlCardJson, post.text);
    if (!articleUrl) return [];
    return [{ postId: post.id, articleUrl }];
  });

  return withCors({ items });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return withCors({ error: "認証されていません" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors({ error: "Invalid JSON" }, { status: 400 });
  }

  const { postId, articleUrl, title, body: articleBody } = body as {
    postId?: string;
    articleUrl?: string;
    title?: string | null;
    body?: string;
  };

  if (!articleBody || typeof articleBody !== "string") {
    return withCors({ error: "body は必須です" }, { status: 400 });
  }
  if (articleBody.trim().length < 30) {
    return withCors({ error: "body が短すぎます（30文字以上必要）" }, { status: 400 });
  }

  let targetPostId = postId;

  if (!targetPostId && articleUrl) {
    if (!X_ARTICLE_RE.test(articleUrl)) {
      return withCors({ error: "X Article URL ではありません" }, { status: 400 });
    }
    const articleId = getArticleIdFromUrl(articleUrl);
    const pending = await prisma.post.findMany({
      where: { enrichmentStatus: "x_article_pending" },
      select: { id: true, urlCardJson: true, text: true },
    });
    const match = pending.find((p) => {
      const found = findArticleUrl(p.urlCardJson, p.text);
      if (!found) return false;
      if (found === articleUrl) return true;
      if (articleId && getArticleIdFromUrl(found) === articleId) return true;
      return false;
    });
    if (!match) {
      return withCors({ error: "対象の取得待ち投稿が見つかりません" }, { status: 404 });
    }
    targetPostId = match.id;
  }

  if (!targetPostId || typeof targetPostId !== "string") {
    return withCors({ error: "postId または articleUrl は必須です" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: targetPostId } });
  if (!post) {
    return withCors({ error: "投稿が見つかりません" }, { status: 404 });
  }

  const newText =
    title && title.trim()
      ? `${title.trim()}\n\n${articleBody}`
      : articleBody;

  await prisma.post.update({
    where: { id: targetPostId },
    data: { text: newText, enrichmentStatus: "done" },
  });

  return withCors({ ok: true, postId: targetPostId });
}
