import { NextResponse } from "next/server";
import { getTrendDigest } from "@/lib/x/trendDigest";

export async function GET() {
  const digest = await getTrendDigest();
  return NextResponse.json(digest ?? { content: null });
}

export async function POST() {
  return NextResponse.json(
    { error: "トレンドの新規生成は停止中です" },
    { status: 410 }
  );
}
