import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { AiModelOverride, SourcePostForLearning } from "@/lib/ai/types";
import { promotePatternAsset } from "@/lib/assets/promotePattern";
import { buildSourcePost, getPostForLearning } from "@/lib/posts/learningSource";

export interface GenerateLearningCardOptions {
  learningMode?: "content" | "format";
  override?: AiModelOverride | null;
}

export async function generateLearningCard(
  postId: string,
  options: GenerateLearningCardOptions = {},
) {
  const post = await getPostForLearning(postId);
  if (!post) return null;

  const source = await buildSourcePost(post);
  const sourceWithMode: SourcePostForLearning = {
    ...source,
    learningMode: options.learningMode ?? "content",
  };
  const learningOutput = await getAiProvider().generateLearningCard(
    sourceWithMode,
    options.override,
  );
  const draftOutput = { ...learningOutput, sourcePostId: post.id, status: "draft" as const };

  // 学習カードを再生成したら厳密学習は古くなるため null に戻し、クライアント側で別途再生成させる。
  const learningCard = await prisma.learningCard.upsert({
    where: { sourcePostId: post.id },
    create: {
      sourcePostId: post.id,
      title: draftOutput.title,
      summary: draftOutput.summary,
      coreInsight: draftOutput.coreInsight ?? "",
      manual: draftOutput.manual ?? "",
      diagramPrompt: JSON.stringify(draftOutput.diagramStructure ?? {}),
      imagePrompt: draftOutput.imageExplanationPrompt ?? "",
      outputJson: JSON.stringify(draftOutput),
      userMemo: draftOutput.userLearningMemo,
      status: "draft",
      learningMode: sourceWithMode.learningMode ?? "content",
      strictLearningJson: null,
    },
    update: {
      title: draftOutput.title,
      summary: draftOutput.summary,
      coreInsight: draftOutput.coreInsight ?? "",
      manual: draftOutput.manual ?? "",
      diagramPrompt: JSON.stringify(draftOutput.diagramStructure ?? {}),
      imagePrompt: draftOutput.imageExplanationPrompt ?? "",
      outputJson: JSON.stringify(draftOutput),
      userMemo: draftOutput.userLearningMemo,
      status: "draft",
      learningMode: sourceWithMode.learningMode ?? "content",
      strictLearningJson: null,
    },
  });

  await promotePatternAsset(learningCard.id, draftOutput.decode);

  return { post, learningCard, output: draftOutput, strictLearning: null };
}
