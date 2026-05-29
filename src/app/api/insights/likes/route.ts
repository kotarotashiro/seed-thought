import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";

// 傾向分析のLLM呼び出し。Vercel Hobby(Fluid Compute)上限の300秒まで引き上げ、
// Kimi等の遅いモデルでも打ち切られないようにする。
export const maxDuration = 300;

const CACHE_KEY = "insights.likes.cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  try {
    // Return cached result unless force refresh
    if (!force) {
      const cached = await prisma.appSetting.findUnique({ where: { key: CACHE_KEY } });
      if (cached) {
        const data = JSON.parse(cached.valueJson);
        return NextResponse.json({ ...data, cachedAt: cached.updatedAt });
      }
    }

    const posts = await prisma.post.findMany({
      where: { savedType: "like", classification: { isNot: null } },
      include: { classification: true },
      orderBy: { savedAt: "desc" },
    });

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

    if (posts.length === 0) {
      return NextResponse.json({ insight: null, count: 0, stats: { categoryCount, typeCount } });
    }

    const postSummaries = posts.map((p) => ({
      summary: p.classification!.summary,
      primaryCategory: p.classification!.primaryCategory,
      postType: p.classification!.postType,
      tags: JSON.parse(p.classification!.tagsJson || "[]") as string[],
      difficultyLevel: p.classification!.difficultyLevel,
    }));

    const insight = await getAiProvider().analyzeLikeTrends(postSummaries);
    const payload = { insight, count: posts.length, stats: { categoryCount, typeCount } };

    await prisma.appSetting.upsert({
      where: { key: CACHE_KEY },
      create: { key: CACHE_KEY, valueJson: JSON.stringify(payload) },
      update: { valueJson: JSON.stringify(payload) },
    });

    const saved = await prisma.appSetting.findUnique({ where: { key: CACHE_KEY } });
    return NextResponse.json({ ...payload, cachedAt: saved?.updatedAt ?? new Date() });
  } catch (error) {
    console.error("Like trend analysis failed:", error);
    return NextResponse.json({ error: "傾向分析に失敗しました" }, { status: 500 });
  }
}
