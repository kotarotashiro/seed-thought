import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string; imageId: string }> }
) {
  const { cardId, imageId } = await params;
  try {
    await prisma.learningCardImage.deleteMany({
      where: { id: imageId, learningCardId: cardId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete image:", error);
    return NextResponse.json(
      { error: "画像の削除に失敗しました" },
      { status: 500 }
    );
  }
}
