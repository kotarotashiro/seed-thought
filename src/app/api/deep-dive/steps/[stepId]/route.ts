import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// PUT /api/deep-dive/steps/[stepId] - Update a step (user note, completion)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const { stepId } = await params;
  try {
    const body = await request.json();
    const { userNote, completed } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (userNote !== undefined) updateData.userNote = userNote;
    if (completed !== undefined) updateData.completed = completed;

    const step = await prisma.deepDiveStep.update({
      where: { id: stepId },
      data: updateData,
    });

    return NextResponse.json(step);
  } catch (error) {
    console.error("Failed to update step:", error);
    return NextResponse.json(
      { error: "ステップの更新に失敗しました" },
      { status: 500 }
    );
  }
}
