import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const collections = await prisma.collection.findMany({
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            learningCard: {
              select: {
                id: true,
                title: true,
                summary: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ collections });
  } catch (error) {
    console.error("Failed to list collections:", error);
    return NextResponse.json(
      { error: "コレクションの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      idea?: string;
      learningCardIds?: string[];
    };
    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
    }

    const cardIds = Array.isArray(body.learningCardIds) ? body.learningCardIds : [];

    const collection = await prisma.collection.create({
      data: {
        title,
        description: body.description?.trim() || null,
        idea: body.idea?.trim() || null,
        items: {
          create: cardIds.map((cardId, idx) => ({
            learningCardId: cardId,
            order: idx,
          })),
        },
      },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { learningCard: true },
        },
      },
    });

    return NextResponse.json({ collection });
  } catch (error) {
    console.error("Failed to create collection:", error);
    return NextResponse.json(
      { error: "コレクションの作成に失敗しました" },
      { status: 500 }
    );
  }
}
