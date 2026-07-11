import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { SynthesisMaterial } from "@/lib/ai/types";
import {
  buildCardMaterial,
  buildPatternMaterial,
  getDecode,
  parseJsonArray,
} from "@/lib/synthesis/buildMaterial";
import { todayKeyJst } from "@/lib/synthesis/dateKey";
import {
  selectPair,
  type PairCandidateAsset,
  type PairCandidateCard,
  type SelectedPair,
} from "@/lib/synthesis/selectPair";

export const maxDuration = 60;

type SuggestionRecord = {
  id: string;
  status: string;
  cardAId: string;
  cardBId: string | null;
  patternAssetId: string | null;
  title: string;
  angle: string;
  reason: string;
  takeaway: string;
  seedHook: string | null;
  collectionId: string | null;
};

async function buildSuggestionResponse(
  suggestion: SuggestionRecord,
  remainingRegenerations: number
) {
  const cardIds = [suggestion.cardAId, suggestion.cardBId].filter(
    (id): id is string => Boolean(id)
  );
  const [cards, asset] = await Promise.all([
    prisma.learningCard.findMany({
      where: { id: { in: cardIds } },
      select: { id: true, title: true, sourcePostId: true },
    }),
    suggestion.patternAssetId
      ? prisma.patternAsset.findUnique({
          where: { id: suggestion.patternAssetId },
          select: { id: true, name: true },
        })
      : null,
  ]);
  const cardMap = new Map(cards.map((card) => [card.id, card]));

  const materials: { kind: "card" | "pattern"; title: string; href: string | null }[] = [];
  const cardA = cardMap.get(suggestion.cardAId);
  materials.push({
    kind: "card",
    title: cardA?.title ?? "削除済みカード",
    href: cardA ? `/posts/${cardA.sourcePostId}/learning` : null,
  });

  if (suggestion.cardBId) {
    const cardB = cardMap.get(suggestion.cardBId);
    materials.push({
      kind: "card",
      title: cardB?.title ?? "削除済みカード",
      href: cardB ? `/posts/${cardB.sourcePostId}/learning` : null,
    });
  } else if (suggestion.patternAssetId) {
    materials.push({
      kind: "pattern",
      title: asset?.name ?? "削除済みの型",
      href: "/assets",
    });
  }

  return {
    suggestion: {
      id: suggestion.id,
      status: suggestion.status,
      title: suggestion.title,
      angle: suggestion.angle,
      reason: suggestion.reason,
      takeaway: suggestion.takeaway,
      seedHook: suggestion.seedHook,
      collectionId: suggestion.collectionId,
      materials,
    },
    remainingRegenerations,
  };
}

async function getSelectionData() {
  const [learningCards, assets] = await Promise.all([
    prisma.learningCard.findMany({
      include: {
        sourcePost: {
          include: { classification: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.patternAsset.findMany({
      where: { status: "active" },
    }),
  ]);

  const cards: PairCandidateCard[] = learningCards
    .map((card) => {
      const decode = getDecode(card.outputJson);
      if (!decode?.synthesisTags?.length) return null;
      return {
        cardId: card.id,
        createdAt: card.createdAt,
        primaryCategory: card.sourcePost.classification?.primaryCategory ?? null,
        tags: decode.synthesisTags,
      };
    })
    .filter((card): card is PairCandidateCard => Boolean(card));

  const assetCandidates: PairCandidateAsset[] = assets.map((asset) => ({
    assetId: asset.id,
    learningCardId: asset.learningCardId,
    tags: parseJsonArray(asset.tagsJson),
  }));

  return { learningCards, assets, cards, assetCandidates };
}

function materialPairForSelection(
  selected: Exclude<SelectedPair, null>,
  data: Awaited<ReturnType<typeof getSelectionData>>
): { materialA: SynthesisMaterial; materialB: SynthesisMaterial } | null {
  const cardA = data.learningCards.find((card) => card.id === selected.cardAId);
  if (!cardA) return null;
  const materialA = buildCardMaterial(cardA);
  if (!materialA) return null;

  if (selected.kind === "card_card") {
    const cardB = data.learningCards.find((card) => card.id === selected.cardBId);
    if (!cardB) return null;
    const materialB = buildCardMaterial(cardB);
    if (!materialB) return null;
    return { materialA, materialB };
  }

  const asset = data.assets.find((item) => item.id === selected.patternAssetId);
  if (!asset) return null;
  return { materialA, materialB: buildPatternMaterial(asset) };
}

async function generateAndSaveSuggestion(dateKey: string, usedPairKeys: Set<string>) {
  const data = await getSelectionData();
  const selected = selectPair(data.cards, data.assetCandidates, usedPairKeys);
  if (!selected) return null;

  const materials = materialPairForSelection(selected, data);
  if (!materials) return null;

  const output = await getAiProvider().generateSynthesis(materials);
  return prisma.synthesisSuggestion.create({
    data: {
      dateKey,
      cardAId: selected.cardAId,
      cardBId: selected.kind === "card_card" ? selected.cardBId : null,
      patternAssetId: selected.kind === "card_pattern" ? selected.patternAssetId : null,
      title: output.title,
      angle: output.angle,
      reason: output.reason,
      takeaway: output.takeaway,
      seedHook: output.seedHook,
    },
  });
}

export async function GET() {
  const dateKey = todayKeyJst();

  try {
    const todays = await prisma.synthesisSuggestion.findMany({
      where: { dateKey },
      orderBy: { createdAt: "desc" },
    });
    const remainingForExisting = Math.max(0, 3 - todays.length);
    if (todays.length > 0) {
      return NextResponse.json(
        await buildSuggestionResponse(todays[0], remainingForExisting)
      );
    }

    const suggestion = await generateAndSaveSuggestion(dateKey, new Set());
    if (!suggestion) {
      return NextResponse.json({
        suggestion: null,
        reason: "no_materials",
        remainingRegenerations: 0,
      });
    }

    return NextResponse.json(await buildSuggestionResponse(suggestion, 2));
  } catch (error) {
    console.error("Failed to get today's synthesis:", error);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}
