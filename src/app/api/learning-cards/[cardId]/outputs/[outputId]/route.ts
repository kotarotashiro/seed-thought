import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFacingError } from "@/lib/api/errors";

// DELETE /api/learning-cards/[cardId]/outputs/[outputId]
// Remove a single generated output from a learning card's history.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string; outputId: string }> }
) {
  const { cardId, outputId } = await params;
  try {
    await prisma.learningCardOutput.deleteMany({
      where: { id: outputId, learningCardId: cardId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete learning card output:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "生成履歴の削除に失敗しました") },
      { status: 500 }
    );
  }
}
