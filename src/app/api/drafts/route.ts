import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateDraftForCard } from "@/lib/x/drafts";

export async function GET() {
  try {
    const drafts = await prisma.xDraft.findMany({
      where: { status: { in: ["pending", "approved"] } },
      orderBy: { createdAt: "desc" },
      include: {
        learningCard: {
          select: { id: true, title: true, summary: true },
        },
      },
    });
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("Failed to list drafts:", error);
    return NextResponse.json({ error: "下書き一覧の取得に失敗しました" }, { status: 500 });
  }
}

// Manually trigger draft generation for a learning card.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { learningCardId?: string };
    if (!body.learningCardId) {
      return NextResponse.json({ error: "learningCardId が必要です" }, { status: 400 });
    }
    await generateDraftForCard(body.learningCardId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to generate draft:", error);
    return NextResponse.json({ error: "下書き生成に失敗しました" }, { status: 500 });
  }
}
