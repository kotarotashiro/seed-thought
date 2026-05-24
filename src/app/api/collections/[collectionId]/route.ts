import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  try {
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            learningCard: {
              include: {
                sourcePost: {
                  include: { classification: true },
                },
              },
            },
          },
        },
      },
    });
    if (!collection) {
      return NextResponse.json({ error: "コレクションが見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ collection });
  } catch (error) {
    console.error("Failed to fetch collection:", error);
    return NextResponse.json(
      { error: "コレクションの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      idea?: string;
      learningCardIds?: string[];
    };

    const existing = await prisma.collection.findUnique({ where: { id: collectionId } });
    if (!existing) {
      return NextResponse.json({ error: "コレクションが見つかりません" }, { status: 404 });
    }

    const updateData: { title?: string; description?: string | null; idea?: string | null } = {};
    if (body.title !== undefined) {
      const trimmed = body.title.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
      }
      updateData.title = trimmed;
    }
    if (body.description !== undefined) {
      updateData.description = body.description.trim() || null;
    }
    if (body.idea !== undefined) {
      updateData.idea = body.idea.trim() || null;
    }

    await prisma.collection.update({ where: { id: collectionId }, data: updateData });

    // Re-set items in order if learningCardIds provided
    if (Array.isArray(body.learningCardIds)) {
      await prisma.$transaction([
        prisma.collectionItem.deleteMany({ where: { collectionId } }),
        prisma.collectionItem.createMany({
          data: body.learningCardIds.map((cardId, idx) => ({
            collectionId,
            learningCardId: cardId,
            order: idx,
          })),
        }),
      ]);
    }

    const refreshed = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { learningCard: true },
        },
      },
    });
    return NextResponse.json({ collection: refreshed });
  } catch (error) {
    console.error("Failed to update collection:", error);
    return NextResponse.json(
      { error: "コレクションの更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  try {
    await prisma.collection.delete({ where: { id: collectionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete collection:", error);
    return NextResponse.json(
      { error: "コレクションの削除に失敗しました" },
      { status: 500 }
    );
  }
}
