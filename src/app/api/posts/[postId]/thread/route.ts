import { NextResponse } from "next/server";
import { fetchAndSaveThread } from "@/lib/x/thread";
import { prisma } from "@/lib/db/prisma";
import { getUserFacingError } from "@/lib/api/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  try {
    const result = await fetchAndSaveThread(postId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch thread:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "ツリーの取得に失敗しました") },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[postId]/thread - Delete selected fetched thread posts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "削除するツリー投稿を選択してください" }, { status: 400 });
    }

    const result = await prisma.threadPost.deleteMany({
      where: {
        postId,
        id: { in: ids },
      },
    });

    return NextResponse.json({ deletedCount: result.count });
  } catch (error) {
    console.error("Failed to delete thread posts:", error);
    return NextResponse.json(
      { error: "ツリー投稿の削除に失敗しました" },
      { status: 500 }
    );
  }
}
