import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { ids?: string[] };
    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids は空でない配列を指定してください" }, { status: 400 });
    }
    const { count } = await prisma.learningCard.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Failed to bulk-delete learning cards:", error);
    return NextResponse.json({ error: "一括削除に失敗しました" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const category = searchParams.get("category") || "";
  const cursor = searchParams.get("cursor") || "";

  const rawLimit = parseInt(searchParams.get("limit") || "24", 10);
  const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 24 : Math.min(rawLimit, 50);

  const isFirstPage = !cursor;

  try {
    const where: Prisma.LearningCardWhereInput = {};
    if (category) {
      where.sourcePost = { classification: { primaryCategory: category } };
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { summary: { contains: search } },
        { coreInsight: { contains: search } },
        { userMemo: { contains: search } },
        { sourcePost: { text: { contains: search } } },
      ];
    }

    const rows = await prisma.learningCard.findMany({
      where,
      include: {
        sourcePost: {
          include: {
            classification: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasNextPage = rows.length > limit;
    const learningCards = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? learningCards[learningCards.length - 1].id : null;

    // Total and the full category list are only needed for the first page.
    let total: number | undefined;
    let categories: string[] | undefined;
    if (isFirstPage) {
      total = await prisma.learningCard.count({ where });
      const categoryRows = await prisma.postClassification.findMany({
        where: { post: { learningCard: { isNot: null } } },
        select: { primaryCategory: true },
        distinct: ["primaryCategory"],
        orderBy: { primaryCategory: "asc" },
      });
      categories = categoryRows.map((c) => c.primaryCategory).filter(Boolean);
    }

    return NextResponse.json({ learningCards, nextCursor, total, categories });
  } catch (error) {
    console.error("Failed to fetch learning cards:", error);
    return NextResponse.json(
      { error: "学習カード一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
