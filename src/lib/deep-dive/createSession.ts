import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { PostClassificationResult } from "@/lib/ai/types";
import { createFallbackDeepDiveSession } from "@/lib/ai/fallback";
import { buildPostTextWithThread } from "@/lib/posts/threadText";
import { resolveArticleForAi } from "@/lib/posts/articleContent";

export async function createDeepDiveSession(
  postId: string,
  mode: "thought_lens" | "learning_lesson"
) {
  // Get the post and its classification
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      classification: true,
      threadPosts: { orderBy: { threadOrder: "asc" } },
    },
  });

  if (!post) throw new Error("投稿が見つかりません");

  const classification: PostClassificationResult = post.classification
    ? {
        postType: post.classification.postType as PostClassificationResult["postType"],
        primaryCategory: post.classification.primaryCategory,
        tags: JSON.parse(post.classification.tagsJson || "[]"),
        summary: post.classification.summary,
        recommendReason: post.classification.recommendReason,
        difficultyLevel: post.classification.difficultyLevel as PostClassificationResult["difficultyLevel"],
        thinkingPotentialScore: post.classification.thinkingPotentialScore,
        learningPotentialScore: post.classification.learningPotentialScore,
        outputPotentialScore: post.classification.outputPotentialScore,
        recommendedMode: post.classification.recommendedMode as PostClassificationResult["recommendedMode"],
      }
    : {
        postType: "unknown",
        primaryCategory: "未分類",
        tags: [],
        summary: post.text.substring(0, 100),
        recommendReason: "",
        difficultyLevel: "unknown",
        thinkingPotentialScore: 50,
        learningPotentialScore: 50,
        outputPotentialScore: 50,
        recommendedMode: "unknown",
      };

  // Resolve article content: user-pasted > cached metadata > live fetch
  const { title: articleTitle, description: articleDescription } = await resolveArticleForAi(
    post.urlCardJson,
    post.text,
  );

  // Generate all steps via AI at session creation (batch generation)
  const provider = getAiProvider();
  const postText = buildPostTextWithThread(post);
  const result = await provider
    .generateDeepDiveSession({
      mode,
      postText,
      classification,
      articleTitle,
      articleDescription,
    })
    .catch((error) => {
      console.error("Deep-dive generation failed, using fallback:", error);
      return createFallbackDeepDiveSession({
        mode,
        postText,
        classification,
      });
    });

  // Create session and steps in a transaction
  const session = await prisma.deepDiveSession.create({
    data: {
      postId,
      mode,
      status: "in_progress",
      currentStep: 0,
      steps: {
        create: result.steps.map((step) => ({
          stepIndex: step.stepIndex,
          stepKey: step.stepKey,
          title: step.title,
          question: step.question,
          aiContentJson: JSON.stringify(step.aiContent),
          completed: false,
        })),
      },
    },
    include: {
      steps: { orderBy: { stepIndex: "asc" } },
      post: { include: { classification: true, threadPosts: { orderBy: { threadOrder: "asc" } } } },
    },
  });

  return session;
}
