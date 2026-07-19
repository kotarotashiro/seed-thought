import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  try {
    const tasks = await prisma.autoLearnTask.findMany({
      where: {
        status: "done",
        updatedAt: { gte: since },
        post: { learningCard: { isNot: null } },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        postId: true,
        updatedAt: true,
        post: {
          select: {
            authorName: true,
            authorUsername: true,
            authorAvatarUrl: true,
            learningCard: {
              select: {
                id: true,
                title: true,
                summary: true,
              },
            },
          },
        },
      },
    });

    const cards = tasks.flatMap((task) => {
      const card = task.post.learningCard;
      if (!card) return [];
      return [{
        postId: task.postId,
        learnedAt: task.updatedAt.toISOString(),
        authorName: task.post.authorName,
        authorUsername: task.post.authorUsername,
        authorAvatarUrl: task.post.authorAvatarUrl,
        ...card,
      }];
    });

    return NextResponse.json({ count: cards.length, cards });
  } catch (error) {
    console.error("Failed to fetch recent auto-learned cards:", error);
    return NextResponse.json(
      { error: "新しく理解された素材の取得に失敗しました" },
      { status: 500 },
    );
  }
}