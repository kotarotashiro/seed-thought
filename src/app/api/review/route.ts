import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { nextSchedule, type ReviewResult } from "@/lib/srs/schedule";

// GET /api/review — return today's due queue (saved cards that are due or never reviewed)
export async function GET() {
  try {
    const now = new Date();
    const cards = await prisma.learningCard.findMany({
      where: {
        status: "saved",
        OR: [
          { nextDueAt: null },
          { nextDueAt: { lte: now } },
        ],
      },
      include: {
        sourcePost: {
          include: { classification: true },
        },
      },
      orderBy: [
        { nextDueAt: { sort: "asc", nulls: "first" } },
        { updatedAt: "desc" },
      ],
      take: 20,
    });

    const upcoming = await prisma.learningCard.count({
      where: {
        status: "saved",
        nextDueAt: { gt: now },
      },
    });

    return NextResponse.json({ cards, dueCount: cards.length, upcomingCount: upcoming });
  } catch (error) {
    console.error("Failed to fetch review queue:", error);
    return NextResponse.json(
      { error: "復習キューの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/review — record a review for a card
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cardId?: string; result?: ReviewResult };
    const { cardId, result } = body;
    if (!cardId || (result !== "again" && result !== "good" && result !== "easy")) {
      return NextResponse.json(
        { error: "cardId と result(again|good|easy) を指定してください" },
        { status: 400 }
      );
    }

    const current = await prisma.learningCard.findUnique({ where: { id: cardId } });
    if (!current) {
      return NextResponse.json({ error: "学習カードが見つかりません" }, { status: 404 });
    }

    const now = new Date();
    const { nextLevel, nextDueAt } = nextSchedule(current.reviewLevel, result, now);

    const updated = await prisma.learningCard.update({
      where: { id: cardId },
      data: {
        reviewLevel: nextLevel,
        lastReviewedAt: now,
        nextDueAt,
      },
    });

    return NextResponse.json({
      id: updated.id,
      reviewLevel: updated.reviewLevel,
      lastReviewedAt: updated.lastReviewedAt,
      nextDueAt: updated.nextDueAt,
    });
  } catch (error) {
    console.error("Failed to record review:", error);
    return NextResponse.json(
      { error: "復習結果の保存に失敗しました" },
      { status: 500 }
    );
  }
}
