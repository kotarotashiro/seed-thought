import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.researchSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }
}
