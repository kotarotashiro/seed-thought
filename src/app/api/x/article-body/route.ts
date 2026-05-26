import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { X_ARTICLE_RE } from "@/lib/x/article";
import { parseArticleContent } from "@/lib/posts/articleContent";

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

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
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

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { postId, title, body: articleBody } = body as {
    postId?: string;
    title?: string | null;
    body?: string;
  };

  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId は必須です" }, { status: 400 });
  }
  if (!articleBody || typeof articleBody !== "string") {
    return NextResponse.json({ error: "body は必須です" }, { status: 400 });
  }
  if (articleBody.trim().length < 30) {
    return NextResponse.json({ error: "body が短すぎます（30文字以上必要）" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
  }

  const newText =
    title && title.trim()
      ? `${title.trim()}\n\n${articleBody}`
      : articleBody;

  await prisma.post.update({
    where: { id: postId },
    data: { text: newText, enrichmentStatus: "done" },
  });

  return NextResponse.json({ ok: true });
}
