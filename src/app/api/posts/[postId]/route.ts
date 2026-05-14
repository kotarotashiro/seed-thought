import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/posts/[postId]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        classification: true,
        deepDiveSessions: {
          include: { steps: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("Failed to fetch post:", error);
    return NextResponse.json({ error: "投稿の取得に失敗しました" }, { status: 500 });
  }
}

// PUT /api/posts/[postId]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const body = await request.json();
    const { text, genre, postType } = body;

    const post = await prisma.post.update({
      where: { id: postId },
      data: { text },
    });

    if (genre || postType) {
      await prisma.postClassification.updateMany({
        where: { postId },
        data: {
          ...(genre && { primaryCategory: genre }),
          ...(postType && { postType }),
        },
      });
    }

    const result = await prisma.post.findUnique({
      where: { id: post.id },
      include: { classification: true },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update post:", error);
    return NextResponse.json({ error: "投稿の更新に失敗しました" }, { status: 500 });
  }
}

// DELETE /api/posts/[postId]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    await prisma.post.delete({ where: { id: postId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return NextResponse.json({ error: "投稿の削除に失敗しました" }, { status: 500 });
  }
}
