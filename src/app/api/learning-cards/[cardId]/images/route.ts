import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  try {
    const images = await prisma.learningCardImage.findMany({
      where: { learningCardId: cardId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        prompt: true,
        mimeType: true,
        dataBase64: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ images });
  } catch (error) {
    console.error("Failed to list images:", error);
    return NextResponse.json(
      { error: "画像一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "画像の新規生成は停止中です" },
    { status: 410 }
  );
}
