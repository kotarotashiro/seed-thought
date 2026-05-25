import { prisma } from "@/lib/db/prisma";
import { xaiSearchX } from "@/lib/xai/client";
import { getProfile } from "@/lib/profile/fixedProfile";
import { createFallbackClassification } from "@/lib/ai/fallback";
import { getAiProvider } from "@/lib/ai/provider";

const MIN_INTERVAL_HOURS = 24;

async function getTopCategories(limit = 3): Promise<string[]> {
  const rows = await prisma.postClassification.groupBy({
    by: ["primaryCategory"],
    _count: { primaryCategory: true },
    orderBy: { _count: { primaryCategory: "desc" } },
    take: limit,
  });
  return rows.map((r) => r.primaryCategory).filter(Boolean);
}

async function shouldRun(): Promise<boolean> {
  if (!process.env.GROK_API_KEY && !process.env.XAI_API_KEY) return false;

  const since = new Date(Date.now() - MIN_INTERVAL_HOURS * 60 * 60 * 1000);
  const recent = await prisma.post.findFirst({
    where: { source: "agent_recommend", savedAt: { gte: since } },
    select: { id: true },
  });
  return !recent;
}

async function saveRecommendation(text: string, query: string): Promise<void> {
  const post = await prisma.post.create({
    data: {
      source: "agent_recommend",
      savedType: "manual",
      text,
      authorName: "SeedThought AI",
      authorUsername: "seedthought_ai",
      savedAt: new Date(),
      enrichmentStatus: "done",
    },
  });

  try {
    const provider = getAiProvider();
    const classification = await provider.classifyPost({ text });
    await prisma.postClassification.create({
      data: {
        postId: post.id,
        postType: classification.postType,
        primaryCategory: classification.primaryCategory,
        tagsJson: JSON.stringify(classification.tags),
        summary: classification.summary,
        recommendReason: `AIがXを検索して見つけた「${query}」関連のおすすめ情報`,
        difficultyLevel: classification.difficultyLevel,
        outputPotentialScore: classification.outputPotentialScore,
        learningPotentialScore: classification.learningPotentialScore,
        thinkingPotentialScore: classification.thinkingPotentialScore,
        recommendedMode: classification.recommendedMode,
      },
    });
  } catch {
    const fallback = createFallbackClassification({ text });
    await prisma.postClassification.create({
      data: {
        postId: post.id,
        postType: fallback.postType,
        primaryCategory: fallback.primaryCategory,
        tagsJson: JSON.stringify(fallback.tags),
        summary: fallback.summary,
        recommendReason: `AIがXを検索して見つけた「${query}」関連のおすすめ情報`,
        difficultyLevel: fallback.difficultyLevel,
        outputPotentialScore: fallback.outputPotentialScore,
        learningPotentialScore: fallback.learningPotentialScore,
        thinkingPotentialScore: fallback.thinkingPotentialScore,
        recommendedMode: fallback.recommendedMode,
      },
    });
  }
}

export async function generateRecommendations(): Promise<void> {
  if (!(await shouldRun())) return;

  const [categories, profile] = await Promise.all([getTopCategories(3), getProfile()]);
  if (categories.length === 0) return;

  for (const category of categories) {
    try {
      const query = `${profile.role}向けの${category}に関する最新の洞察やTips (日本語または英語)`;
      const result = await xaiSearchX(query);
      const text = result.content.trim();
      if (text.length > 30) {
        await saveRecommendation(`【AIおすすめ: ${category}】\n\n${text}`, category);
      }
    } catch (error) {
      console.error("Recommendation generation failed for category:", category, error);
    }
  }
}
