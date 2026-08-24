import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { AiModelOverride, SourcePostForLearning } from "@/lib/ai/types";
import { promotePatternAsset } from "@/lib/assets/promotePattern";
import {
  attachLearningMetadata,
  prepareLearningMaterials,
} from "@/lib/posts/learningMaterials";
import { buildSourcePost, getPostForLearning } from "@/lib/posts/learningSource";

export interface GenerateLearningCardOptions {
  learningMode?: "content" | "format";
  override?: AiModelOverride | null;
  /** 未取得素材を通常導線から外し、ユーザーが明示した副操作でのみ許可する。 */
  allowIncomplete?: boolean;
}

export async function generateLearningCard(
  postId: string,
  options: GenerateLearningCardOptions = {},
) {
  const existingPost = await getPostForLearning(postId);
  if (!existingPost) return null;
  const prepared = await prepareLearningMaterials(postId, { allowIncomplete: options.allowIncomplete });
  const post = prepared.post;

  const source = await buildSourcePost(post, prepared.materials);
  const sourceWithMode: SourcePostForLearning = {
    ...source,
    learningMode: options.learningMode ?? "content",
  };
  const generatedOutput = await getAiProvider().generateLearningCard(
    sourceWithMode,
    options.override,
  );
  const learningOutput = attachLearningMetadata(generatedOutput, prepared.materials, new Date().toISOString(), {
    excludedSourceIds: prepared.excludedSourceIds,
  });
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

  return { post, learningCard, output: draftOutput, strictLearning: null, materials: prepared.materials };
}
