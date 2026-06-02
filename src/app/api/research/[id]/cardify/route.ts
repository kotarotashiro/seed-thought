import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await prisma.researchSession.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: "リサーチセッションが見つかりません" }, { status: 404 });
    }

    const post = await prisma.post.create({
      data: {
        source: "user_manual",
        savedType: "manual",
        text: `【リサーチ】${session.query}\n\n${session.answer}`,
        authorName: "リサーチ結果",
        authorUsername: "research",
        enrichmentStatus: "done",
      },
    });

    return NextResponse.json({ postId: post.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
