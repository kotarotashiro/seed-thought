import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
