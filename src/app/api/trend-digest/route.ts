import { NextResponse } from "next/server";
import { getTrendDigest, generateTrendDigest } from "@/lib/x/trendDigest";

export async function GET() {
  const digest = await getTrendDigest();
  return NextResponse.json(digest ?? { content: null });
}

export async function POST() {
  try {
    await generateTrendDigest();
    const digest = await getTrendDigest();
    return NextResponse.json(digest ?? { content: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
