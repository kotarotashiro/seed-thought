import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const { suggestionId } = await params;

  try {
    const suggestion = await prisma.synthesisSuggestion.findUnique({
      where: { id: suggestionId },
      select: { id: true },
    });
    if (!suggestion) {
      return NextResponse.json({ error: "suggestion_not_found" }, { status: 404 });
    }

    await prisma.synthesisSuggestion.update({
      where: { id: suggestionId },
      data: { status: "dismissed" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to dismiss synthesis:", error);
    return NextResponse.json({ error: "dismiss_failed" }, { status: 500 });
  }
}
