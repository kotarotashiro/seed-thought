import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { XAI_OAUTH_ID } from "@/lib/xai/oauth";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    await prisma.xAuth.deleteMany({ where: { id: XAI_OAUTH_ID } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[grok/disconnect]", error);
    return NextResponse.json({ error: "Grok OAuth接続の解除に失敗しました" }, { status: 500 });
  }
}
