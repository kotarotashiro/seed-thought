import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    if (body.status !== "active" && body.status !== "archived") {
      return NextResponse.json(
        { error: "status は active または archived を指定してください" },
        { status: 400 }
      );
    }

    await prisma.patternAsset.update({
      where: { id: assetId },
      data: { status: body.status },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update asset:", error);
    return NextResponse.json({ error: "資産の更新に失敗しました" }, { status: 500 });
  }
}
