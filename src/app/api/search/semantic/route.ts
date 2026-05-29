import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";

// LLM呼び出しを伴うため、Kimi等の遅いモデルでもデフォルト枠で打ち切られないよう引き上げる。
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body as { query: string };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ error: "検索クエリを入力してください" }, { status: 400 });
    }

    const posts = await prisma.post.findMany({
      where: { classification: { isNot: null } },
      include: { classification: true },
      orderBy: { savedAt: "desc" },
      take: 200,
    });

    const postSummaries = posts
      .filter((p) => p.classification?.summary)
      .map((p) => ({
        id: p.id,
        summary: p.classification!.summary,
        tags: JSON.parse(p.classification!.tagsJson || "[]") as string[],
        primaryCategory: p.classification!.primaryCategory,
        postType: p.classification!.postType,
      }));

    if (postSummaries.length === 0) {
      return NextResponse.json({ results: [], posts: [] });
    }

    const searchResult = await getAiProvider().searchSemantically(query.trim(), postSummaries);

    const resultPostIds = searchResult.results.map((r) => r.postId);
    const matchedPosts = await prisma.post.findMany({
      where: { id: { in: resultPostIds } },
      include: { classification: true },
    });

    const postMap = new Map(matchedPosts.map((p) => [p.id, p]));
    const enriched = searchResult.results
      .map((r) => ({
        ...r,
        post: postMap.get(r.postId) ?? null,
      }))
      .filter((r) => r.post !== null);

    return NextResponse.json({ results: enriched });
  } catch (error) {
    console.error("Semantic search failed:", error);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
