import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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

export async function GET() {
  try {
    const learningCards = await prisma.learningCard.findMany({
      include: {
        sourcePost: {
          include: {
            classification: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ learningCards });
  } catch (error) {
    console.error("Failed to fetch learning cards:", error);
    return NextResponse.json(
      { error: "学習カード一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
