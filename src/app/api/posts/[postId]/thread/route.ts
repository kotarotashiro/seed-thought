import { NextResponse } from "next/server";
import { fetchAndSaveThread, addManualThreadPost } from "@/lib/x/thread";
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

// PATCH /api/posts/[postId]/thread - 手動でツリー投稿を強制追記
// Body: { url?: string, text?: string, translatedText?: string }
//   - url を指定すれば X API でその投稿を取得して追記
//   - text を指定すれば手動入力としてそのまま保存（X APIが使えないときの逃げ道）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const translatedText =
      typeof body.translatedText === "string" && body.translatedText.trim()
        ? body.translatedText.trim()
        : null;

    if (!url && !text) {
      return NextResponse.json(
        { error: "ツリーに追記する内容（URL または本文）を指定してください" },
        { status: 400 }
      );
    }

    const result = await addManualThreadPost(postId, { url, text, translatedText });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to add manual thread post:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "ツリーへの追記に失敗しました") },
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
