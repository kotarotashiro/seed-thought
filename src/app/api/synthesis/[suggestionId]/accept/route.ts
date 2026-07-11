import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function buildIdea(suggestion: {
  angle: string;
  reason: string;
  takeaway: string;
  seedHook: string | null;
}, pattern: { name: string; structure: string; transferScope: string } | null): string {
  const parts = [
    suggestion.angle,
    suggestion.reason,
    `持ち帰り: ${suggestion.takeaway}`,
  ];
  if (suggestion.seedHook) {
    parts.push(`冒頭フック案: ${suggestion.seedHook}`);
  }
  if (pattern) {
    parts.push(
      `使う型: ${pattern.name}\n${pattern.structure}\n転用範囲: ${pattern.transferScope}`
    );
  }
  return parts.join("\n\n");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const { suggestionId } = await params;

  try {
    const suggestion = await prisma.synthesisSuggestion.findUnique({
      where: { id: suggestionId },
    });
    if (!suggestion) {
      return NextResponse.json({ error: "suggestion_not_found" }, { status: 404 });
    }
    if (suggestion.status === "accepted" && suggestion.collectionId) {
      return NextResponse.json({ collectionId: suggestion.collectionId });
    }

    const [pattern, existingCards] = await Promise.all([
      suggestion.patternAssetId
        ? prisma.patternAsset.findUnique({
            where: { id: suggestion.patternAssetId },
            select: { name: true, structure: true, transferScope: true },
          })
        : null,
      prisma.learningCard.findMany({
        where: {
          id: {
            in: [suggestion.cardAId, suggestion.cardBId].filter(
              (id): id is string => Boolean(id)
            ),
          },
        },
        select: { id: true },
      }),
    ]);
    const existingCardIds = new Set(existingCards.map((card) => card.id));
    const itemIds = [suggestion.cardAId, suggestion.cardBId].filter((id): id is string => {
      return id !== null && existingCardIds.has(id);
    });

    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.synthesisSuggestion.findUnique({
        where: { id: suggestionId },
      });
      if (!latest) throw new Error("suggestion_not_found");
      if (latest.status === "accepted" && latest.collectionId) {
        return { collectionId: latest.collectionId };
      }

      const collection = await tx.collection.create({
        data: {
          title: suggestion.title,
          idea: buildIdea(suggestion, pattern),
        },
      });

      if (itemIds.length > 0) {
        await tx.collectionItem.createMany({
          data: itemIds.map((cardId, index) => ({
            collectionId: collection.id,
            learningCardId: cardId,
            order: index,
          })),
        });
      }

      await tx.synthesisSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: "accepted",
          collectionId: collection.id,
        },
      });

      return { collectionId: collection.id };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to accept synthesis:", error);
    return NextResponse.json({ error: "accept_failed" }, { status: 500 });
  }
}
