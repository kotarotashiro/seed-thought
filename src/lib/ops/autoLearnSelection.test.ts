import { describe, expect, it } from "vitest";
import { selectNextAutoLearnTask, type AutoLearnTaskCandidate } from "./autoLearnSelection";

function candidate(
  id: string,
  createdAt: string,
  source: string,
  learningPotentialScore: number,
  hasLearningCard = false,
): AutoLearnTaskCandidate {
  return {
    id,
    postId: "post-" + id,
    createdAt: new Date(createdAt),
    post: {
      classification: { source, learningPotentialScore },
      learningCard: hasLearningCard ? { id: "card-" + id } : null,
    },
  };
}

describe("selectNextAutoLearnTask", () => {
  it("prioritizes AI classification before score and creation time", () => {
    const selected = selectNextAutoLearnTask([
      candidate("fallback-high", "2026-07-19T00:00:00.000Z", "fallback", 99),
      candidate("ai-old", "2026-07-19T02:00:00.000Z", "ai", 40),
      candidate("ai-high", "2026-07-19T03:00:00.000Z", "ai", 80),
    ]);

    expect(selected?.id).toBe("ai-high");
  });

  it("uses the oldest task when source and score tie", () => {
    const selected = selectNextAutoLearnTask([
      candidate("newer", "2026-07-19T02:00:00.000Z", "fallback", 60),
      candidate("older", "2026-07-19T01:00:00.000Z", "fallback", 60),
    ]);

    expect(selected?.id).toBe("older");
  });
});
