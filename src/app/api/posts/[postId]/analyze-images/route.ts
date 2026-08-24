import { NextResponse } from "next/server";
import { getUserFacingError } from "@/lib/api/errors";
import { analyzePostImages } from "@/lib/posts/learningMaterials";

// POST /api/posts/[postId]/analyze-images
// 投稿＋ツリーに添付された画像をビジョンモデルで読み取り、内容説明を mediaJson に保存する。
// 記事URL/動画文字起こしと同じく、学習カード生成の素材として使われる。
// 1枚あたり数秒〜十数秒かかり、複数枚あると合算で長くなるため上限まで引き上げる。
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean((body as { force?: boolean })?.force);

    const result = await analyzePostImages(postId, force);
    return NextResponse.json({
      analyzedCount: result.analyzedCount,
      skippedCount: result.skippedCount,
      failures: result.failures,
      images: result.images,
    });
  } catch (error) {
    console.error("Failed to analyze post images:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "画像の読み取りに失敗しました") },
      { status: 500 }
    );
  }
}
