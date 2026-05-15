import { NextResponse } from "next/server";
import { fetchAndSaveThread } from "@/lib/x/thread";
import { getUserFacingError } from "@/lib/api/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  try {
    const result = await fetchAndSaveThread(postId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch thread:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "ツリーの取得に失敗しました") },
      { status: 500 }
    );
  }
}
