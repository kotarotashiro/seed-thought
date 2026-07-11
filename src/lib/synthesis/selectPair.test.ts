import { describe, expect, it } from "vitest";
import { pairKey, selectPair, type PairCandidateAsset, type PairCandidateCard } from "./selectPair";

function card(
  cardId: string,
  tags: string[],
  createdAt: string,
  primaryCategory: string | null = null
): PairCandidateCard {
  return { cardId, tags, createdAt: new Date(createdAt), primaryCategory };
}

function asset(
  assetId: string,
  tags: string[],
  learningCardId: string | null = null
): PairCandidateAsset {
  return { assetId, tags, learningCardId };
}

describe("selectPair", () => {
  it("prefers a pair with two common tags over one common tag", () => {
    const result = selectPair(
      [
        card("a", ["ai", "sales"], "2026-01-01"),
        card("b", ["ai"], "2026-01-02"),
        card("c", ["ai", "sales"], "2026-01-03"),
      ],
      [],
      new Set()
    );
    expect(result).toEqual({ kind: "card_card", cardAId: "a", cardBId: "c" });
  });

  it("uses the different-category bonus when common tag counts match", () => {
    const result = selectPair(
      [
        card("a", ["ai"], "2026-01-01", "AI"),
        card("b", ["ai"], "2026-01-04", "AI"),
        card("c", ["sales"], "2026-01-02", "営業"),
        card("d", ["sales"], "2026-01-03", "AI"),
      ],
      [],
      new Set()
    );
    expect(result).toEqual({ kind: "card_card", cardAId: "c", cardBId: "d" });
  });

  it("excludes card-pattern combinations from the asset's source card", () => {
    const result = selectPair(
      [card("a", ["prompt"], "2026-01-01")],
      [
        asset("own", ["prompt"], "a"),
        asset("other", ["prompt"], "b"),
      ],
      new Set()
    );
    expect(result).toEqual({ kind: "card_pattern", cardAId: "a", patternAssetId: "other" });
  });

  it("skips used pair keys and chooses the next best pair", () => {
    const used = new Set([pairKey({ kind: "card_card", cardAId: "a", cardBId: "b" })]);
    const result = selectPair(
      [
        card("a", ["ai", "sales"], "2026-01-01"),
        card("b", ["ai", "sales"], "2026-01-03"),
        card("c", ["ai"], "2026-01-02"),
      ],
      [],
      used
    );
    expect(result).toEqual({ kind: "card_card", cardAId: "b", cardBId: "c" });
  });

  it("falls back to the two newest cards when no tags overlap", () => {
    const result = selectPair(
      [
        card("old", ["a"], "2026-01-01"),
        card("newest", ["b"], "2026-01-03"),
        card("middle", ["c"], "2026-01-02"),
      ],
      [],
      new Set()
    );
    expect(result).toEqual({ kind: "card_card", cardAId: "newest", cardBId: "middle" });
  });

  it("returns null when one or fewer decoded cards are available", () => {
    expect(selectPair([card("a", ["ai"], "2026-01-01")], [], new Set())).toBeNull();
    expect(selectPair([], [], new Set())).toBeNull();
  });

  it("uses a deterministic tie break for identical input", () => {
    const cards = [
      card("b", ["ai"], "2026-01-01", "AI"),
      card("a", ["ai"], "2026-01-01", "AI"),
      card("c", ["ai"], "2026-01-01", "AI"),
    ];
    const first = selectPair(cards, [], new Set());
    const second = selectPair(cards, [], new Set());
    expect(first).toEqual(second);
    expect(first).toEqual({ kind: "card_card", cardAId: "b", cardBId: "a" });
  });
});
