import { NextResponse } from "next/server";
import { enrichPostRelatedLinks, readRelatedLinks } from "@/lib/posts/relatedLinks";
import { prisma } from "@/lib/db/prisma";
import { getUserFacingError } from "@/lib/api/errors";

// POST /api/posts/[postId]/enrich-content
// 投稿本文 + ツリーに含まれる全URLを fetch してメタ情報を保存する
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body?.force);
    const result = await enrichPostRelatedLinks(postId, { force });
    return NextResponse.json({
      links: result.links,
      fetchedCount: result.fetchedCount,
      skippedCount: result.skippedCount,
    });
  } catch (error) {
    console.error("Failed to enrich post content:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "投稿内リンクの情報取得に失敗しました") },
      { status: 500 }
    );
  }
}

// GET /api/posts/[postId]/enrich-content - 既に取得済みのリンク情報を返す
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { urlCardJson: true },
    });
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ links: readRelatedLinks(post.urlCardJson) });
  } catch (error) {
    console.error("Failed to load related links:", error);
    return NextResponse.json(
      { error: "リンク情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
