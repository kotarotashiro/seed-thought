export interface PairCandidateCard {
  cardId: string;
  createdAt: Date;
  primaryCategory: string | null;
  tags: string[];
}

export interface PairCandidateAsset {
  assetId: string;
  learningCardId: string | null;
  tags: string[];
}

export type SelectedPair =
  | { kind: "card_card"; cardAId: string; cardBId: string }
  | { kind: "card_pattern"; cardAId: string; patternAssetId: string }
  | null;

type Candidate =
  | {
      kind: "card_card";
      cardAId: string;
      cardBId: string;
      score: number;
      createdAtSum: number;
      tieKey: string;
    }
  | {
      kind: "card_pattern";
      cardAId: string;
      patternAssetId: string;
      score: number;
      tieKey: string;
    };

function normalizeTags(tags: string[]): Set<string> {
  return new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
}

function commonTagCount(a: Set<string>, b: Set<string>): number {
  let common = 0;
  for (const tag of a) {
    if (b.has(tag)) common += 1;
  }
  return common;
}

export function pairKey(pair: Exclude<SelectedPair, null>): string {
  if (pair.kind === "card_card") {
    return [pair.cardAId, pair.cardBId].sort().join(":");
  }
  return `${pair.cardAId}:${pair.patternAssetId}`;
}

function isBetterCandidate(candidate: Candidate, current: Candidate | null): boolean {
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score > current.score;

  if (candidate.kind === "card_card" && current.kind !== "card_card") return true;
  if (candidate.kind !== "card_card" && current.kind === "card_card") return false;

  if (candidate.kind === "card_card" && current.kind === "card_card") {
    if (candidate.createdAtSum !== current.createdAtSum) {
      return candidate.createdAtSum > current.createdAtSum;
    }
  }

  return candidate.tieKey < current.tieKey;
}

function toSelected(candidate: Candidate): Exclude<SelectedPair, null> {
  if (candidate.kind === "card_card") {
    return { kind: "card_card", cardAId: candidate.cardAId, cardBId: candidate.cardBId };
  }
  return {
    kind: "card_pattern",
    cardAId: candidate.cardAId,
    patternAssetId: candidate.patternAssetId,
  };
}

export function selectPair(
  cards: PairCandidateCard[],
  assets: PairCandidateAsset[],
  usedPairKeys: Set<string>
): SelectedPair {
  const cardTags = new Map(cards.map((card) => [card.cardId, normalizeTags(card.tags)]));
  const assetTags = new Map(assets.map((asset) => [asset.assetId, normalizeTags(asset.tags)]));

  let best: Candidate | null = null;

  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const a = cards[i];
      const b = cards[j];
      const selected = { kind: "card_card" as const, cardAId: a.cardId, cardBId: b.cardId };
      if (usedPairKeys.has(pairKey(selected))) continue;

      const common = commonTagCount(cardTags.get(a.cardId) ?? new Set(), cardTags.get(b.cardId) ?? new Set());
      if (common === 0) continue;

      const differentCategory =
        a.primaryCategory !== null &&
        b.primaryCategory !== null &&
        a.primaryCategory !== b.primaryCategory;
      const candidate: Candidate = {
        ...selected,
        score: common * 10 + (differentCategory ? 5 : 0),
        createdAtSum: a.createdAt.getTime() + b.createdAt.getTime(),
        tieKey: [a.cardId, b.cardId].sort().join(":"),
      };
      if (isBetterCandidate(candidate, best)) best = candidate;
    }
  }

  for (const card of cards) {
    for (const asset of assets) {
      if (asset.learningCardId === card.cardId) continue;
      const selected = {
        kind: "card_pattern" as const,
        cardAId: card.cardId,
        patternAssetId: asset.assetId,
      };
      if (usedPairKeys.has(pairKey(selected))) continue;

      const common = commonTagCount(
        cardTags.get(card.cardId) ?? new Set(),
        assetTags.get(asset.assetId) ?? new Set()
      );
      if (common === 0) continue;

      const candidate: Candidate = {
        ...selected,
        score: common * 10 + 3,
        tieKey: `${card.cardId}:${asset.assetId}`,
      };
      if (isBetterCandidate(candidate, best)) best = candidate;
    }
  }

  if (best) return toSelected(best);

  const latestCards = [...cards].sort((a, b) => {
    const byDate = b.createdAt.getTime() - a.createdAt.getTime();
    if (byDate !== 0) return byDate;
    return a.cardId.localeCompare(b.cardId);
  });

  for (let i = 0; i < latestCards.length; i += 1) {
    for (let j = i + 1; j < latestCards.length; j += 1) {
      const selected = {
        kind: "card_card" as const,
        cardAId: latestCards[i].cardId,
        cardBId: latestCards[j].cardId,
      };
      if (!usedPairKeys.has(pairKey(selected))) return selected;
    }
  }

  return null;
}
