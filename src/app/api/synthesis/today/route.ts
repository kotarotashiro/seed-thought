import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { todayKeyJst } from "@/lib/synthesis/dateKey";

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

export async function GET() {
  const dateKey = todayKeyJst();

  try {
    const todays = await prisma.synthesisSuggestion.findMany({
      where: { dateKey },
      orderBy: { createdAt: "desc" },
    });
    const remainingForExisting = Math.max(0, 3 - todays.length);
    if (todays.length === 0) {
      return NextResponse.json({
        suggestion: null,
        reason: "not_generated",
        remainingRegenerations: 3,
      });
    }

    return NextResponse.json(
      await buildSuggestionResponse(todays[0], remainingForExisting)
    );
  } catch (error) {
    console.error("Failed to get today's synthesis:", error);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}