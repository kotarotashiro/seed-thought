import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/deep-dive/sessions/[sessionId]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const session = await prisma.deepDiveSession.findUnique({
      where: { id: sessionId },
      include: {
        post: { include: { classification: true, threadPosts: { orderBy: { threadOrder: "asc" } } } },
        steps: { orderBy: { stepIndex: "asc" } },
        outputs: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return NextResponse.json(
      { error: "セッションの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT /api/deep-dive/sessions/[sessionId] - Update session
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const body = await request.json();
    const { currentStep, status, finalSummary, userFinalNote } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (status) updateData.status = status;
    if (finalSummary !== undefined) updateData.finalSummary = finalSummary;
    if (userFinalNote !== undefined) updateData.userFinalNote = userFinalNote;
    if (status === "completed") updateData.completedAt = new Date();

    const session = await prisma.deepDiveSession.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        post: { include: { classification: true, threadPosts: { orderBy: { threadOrder: "asc" } } } },
        steps: { orderBy: { stepIndex: "asc" } },
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to update session:", error);
    return NextResponse.json(
      { error: "セッションの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/deep-dive/sessions/[sessionId]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    await prisma.deepDiveSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return NextResponse.json(
      { error: "セッションの削除に失敗しました" },
      { status: 500 }
    );
  }
}
