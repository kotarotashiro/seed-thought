import { NextResponse } from "next/server";
import { deleteXaiAuth } from "@/lib/xai/authStore";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    await deleteXaiAuth();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[grok/disconnect]", error);
    return NextResponse.json({ error: "Grok OAuth接続の解除に失敗しました" }, { status: 500 });
  }
}
