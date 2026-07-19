export interface AutoLearnTaskCandidate {
  id: string;
  postId: string;
  createdAt: Date;
  post: {
    classification: {
      source: string;
      learningPotentialScore: number;
    } | null;
    learningCard: { id: string } | null;
  };
}

export function compareAutoLearnTaskCandidates(
  left: AutoLearnTaskCandidate,
  right: AutoLearnTaskCandidate,
): number {
  const leftIsAi = left.post.classification?.source === "ai" ? 1 : 0;
  const rightIsAi = right.post.classification?.source === "ai" ? 1 : 0;
  if (leftIsAi !== rightIsAi) return rightIsAi - leftIsAi;

  const scoreDifference =
    (right.post.classification?.learningPotentialScore ?? 0) -
    (left.post.classification?.learningPotentialScore ?? 0);
  if (scoreDifference !== 0) return scoreDifference;

  return left.createdAt.getTime() - right.createdAt.getTime();
}

export function selectNextAutoLearnTask(
  candidates: AutoLearnTaskCandidate[],
): AutoLearnTaskCandidate | null {
  return [...candidates].sort(compareAutoLearnTaskCandidates)[0] ?? null;
}
