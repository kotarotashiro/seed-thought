import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFacingError } from "@/lib/api/errors";
import { describeImageUrl } from "@/lib/posts/imageVision";
import { XaiTokenExpiredError } from "@/lib/xai/oauth";

// POST /api/posts/[postId]/analyze-images
// 投稿＋ツリーに添付された画像をビジョンモデルで読み取り、内容説明を mediaJson に保存する。
// 記事URL/動画文字起こしと同じく、学習カード生成の素材として使われる。
// 1枚あたり数秒〜十数秒かかり、複数枚あると合算で長くなるため上限まで引き上げる。
export const maxDuration = 300;

type RawMedia = Record<string, unknown> & {
  type?: unknown;
  url?: unknown;
  previewUrl?: unknown;
  description?: unknown;
};

// 読み取り対象の画像URLを決める（写真→url優先、GIF→previewUrl優先。動画は対象外）。
function imageSrc(item: RawMedia): string | null {
  const url = typeof item.url === "string" ? item.url : null;
  const previewUrl = typeof item.previewUrl === "string" ? item.previewUrl : null;
  if (item.type === "photo") return url || previewUrl;
  if (item.type === "animated_gif") return previewUrl || url;
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean((body as { force?: boolean })?.force);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { threadPosts: { orderBy: { threadOrder: "asc" } } },
    });
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    let analyzedCount = 0;
    let skippedCount = 0;
    const images: { url: string; description: string }[] = [];

    // 1つの mediaJson を走査し、画像に description を付与して返す。
    async function annotate(
      mediaJson: string | null
    ): Promise<{ changed: boolean; json: string | null }> {
      if (!mediaJson) return { changed: false, json: mediaJson };
      let arr: unknown;
      try {
        arr = JSON.parse(mediaJson);
      } catch {
        return { changed: false, json: mediaJson };
      }
      if (!Array.isArray(arr)) return { changed: false, json: mediaJson };

      let changed = false;
      for (const item of arr as RawMedia[]) {
        if (!item || typeof item !== "object") continue;
        const src = imageSrc(item);
        if (!src) continue;

        const existing = typeof item.description === "string" ? item.description : "";
        if (existing && !force) {
          skippedCount++;
          images.push({ url: src, description: existing });
          continue;
        }

        try {
          const description = await describeImageUrl(src);
          if (description) {
            item.description = description;
            changed = true;
            analyzedCount++;
            images.push({ url: src, description });
          }
        } catch (error) {
          // token切れは全体を止める。それ以外は1枚失敗しても他の画像を続ける。
          if (error instanceof XaiTokenExpiredError) throw error;
          console.error("[analyze-images] 1枚の読み取りに失敗:", error);
        }
      }
      return { changed, json: changed ? JSON.stringify(arr) : mediaJson };
    }

    const main = await annotate(post.mediaJson);
    if (main.changed) {
      await prisma.post.update({ where: { id: post.id }, data: { mediaJson: main.json } });
    }
    for (const tp of post.threadPosts) {
      const result = await annotate(tp.mediaJson);
      if (result.changed) {
        await prisma.threadPost.update({ where: { id: tp.id }, data: { mediaJson: result.json } });
      }
    }

    return NextResponse.json({ analyzedCount, skippedCount, images });
  } catch (error) {
    if (error instanceof XaiTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "GROK_TOKEN_EXPIRED" },
        { status: 503 }
      );
    }
    console.error("Failed to analyze post images:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "画像の読み取りに失敗しました") },
      { status: 500 }
    );
  }
}
