import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import { needsJapaneseTranslation } from "@/lib/text/language";

const DEFAULT_LIMIT = 30;

interface BackfillResult {
  processedCount: number;
  failedCount: number;
}

export async function backfillAiClassifications(
  postIds?: string[],
  limit: number = DEFAULT_LIMIT,
): Promise<BackfillResult> {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : DEFAULT_LIMIT;
  if (safeLimit === 0) return { processedCount: 0, failedCount: 0 };

  const posts = await prisma.post.findMany({
    where: {
      ...(postIds !== undefined ? { id: { in: postIds } } : {}),
      classification: { is: { source: "fallback" } },
    },
    select: {
      id: true,
      text: true,
      authorName: true,
      authorUsername: true,
    },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  const provider = getAiProvider();
  let processedCount = 0;
  let failedCount = 0;

  for (const post of posts) {
    try {
      const classification = await provider.classifyPost({
        text: post.text,
        authorName: post.authorName,
        authorUsername: post.authorUsername,
      });

      await prisma.postClassification.update({
        where: { postId: post.id },
        data: {
          source: "ai",
          postType: classification.postType,
          primaryCategory: classification.primaryCategory,
          tagsJson: JSON.stringify(classification.tags),
          summary: classification.summary,
          recommendReason: classification.recommendReason,
          difficultyLevel: classification.difficultyLevel,
          outputPotentialScore: classification.outputPotentialScore,
          learningPotentialScore: classification.learningPotentialScore,
          thinkingPotentialScore: classification.thinkingPotentialScore,
          recommendedMode: classification.recommendedMode,
        },
      });

      if (needsJapaneseTranslation(post.text)) {
        try {
          const translatedText = await provider.translateText({ text: post.text });
          await prisma.post.update({
            where: { id: post.id },
            data: { translatedText },
          });
        } catch (error) {
          console.error("[posts/aiBackfill] translation failed for " + post.id + ":", error);
        }
      }

      processedCount++;
    } catch (error) {
      failedCount++;
      console.error("[posts/aiBackfill] classification failed for " + post.id + ":", error);
    }
  }

  return { processedCount, failedCount };
}
