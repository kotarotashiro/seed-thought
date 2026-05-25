import { after } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { initialDueDate } from "@/lib/srs/schedule";
import { generateDraftForCard } from "@/lib/x/drafts";

function mergeUserMemo(outputJson: string, userMemo: string | null | undefined): string {
  try {
    const output = JSON.parse(outputJson);
    if (typeof output === "object" && output !== null && typeof userMemo === "string") {
      return JSON.stringify({ ...output, userLearningMemo: userMemo });
    }
  } catch {
  }
  return outputJson;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  try {
    await prisma.learningCard.delete({ where: { id: cardId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete learning card:", error);
    return NextResponse.json({ error: "学習カードの削除に失敗しました" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  try {
    const body = await request.json();
    const status = body.status;
    const userMemo = body.userMemo;

    if (status !== undefined && status !== "draft" && status !== "saved") {
      return NextResponse.json(
        { error: "status は draft または saved を指定してください" },
        { status: 400 }
      );
    }

    if (userMemo !== undefined && typeof userMemo !== "string") {
      return NextResponse.json(
        { error: "userMemo は文字列で指定してください" },
        { status: 400 }
      );
    }

    const current = await prisma.learningCard.findUnique({ where: { id: cardId } });
    if (!current) {
      return NextResponse.json({ error: "学習カードが見つかりません" }, { status: 404 });
    }

    // When a card is first promoted to "saved", schedule its first review.
    const shouldScheduleFirstReview =
      status === "saved" && current.status !== "saved" && !current.nextDueAt;

    const learningCard = await prisma.learningCard.update({
      where: { id: cardId },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(userMemo !== undefined
          ? { userMemo, outputJson: mergeUserMemo(current.outputJson, userMemo) }
          : {}),
        ...(shouldScheduleFirstReview ? { nextDueAt: initialDueDate() } : {}),
      },
    });

    if (shouldScheduleFirstReview) {
      after(() => generateDraftForCard(cardId));
    }

    return NextResponse.json(learningCard);
  } catch (error) {
    console.error("Failed to update learning card:", error);
    return NextResponse.json({ error: "学習カードの更新に失敗しました" }, { status: 500 });
  }
}
