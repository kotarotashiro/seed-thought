import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";

export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      where: {
        savedType: "like",
        classification: { isNot: null },
      },
      include: { classification: true },
      orderBy: { savedAt: "desc" },
    });

    if (posts.length === 0) {
      return NextResponse.json({ insight: null, count: 0 });
    }

    const postSummaries = posts.map((p) => ({
      summary: p.classification!.summary,
      primaryCategory: p.classification!.primaryCategory,
      postType: p.classification!.postType,
      tags: JSON.parse(p.classification!.tagsJson || "[]") as string[],
      difficultyLevel: p.classification!.difficultyLevel,
    }));

    const insight = await getAiProvider().analyzeLikeTrends(postSummaries);

    const categoryCount = posts.reduce<Record<string, number>>((acc, p) => {
      const cat = p.classification?.primaryCategory ?? "未分類";
      acc[cat] = (acc[cat] ?? 0) + 1;
      return acc;
    }, {});

    const typeCount = posts.reduce<Record<string, number>>((acc, p) => {
      const type = p.classification?.postType ?? "unknown";
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      insight,
      count: posts.length,
      stats: { categoryCount, typeCount },
    });
  } catch (error) {
    console.error("Like trend analysis failed:", error);
    return NextResponse.json({ error: "傾向分析に失敗しました" }, { status: 500 });
  }
}
