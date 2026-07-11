import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseJsonArray } from "@/lib/synthesis/buildMaterial";

export async function GET() {
  try {
    const assets = await prisma.patternAsset.findMany({
      include: {
        learningCard: {
          select: {
            id: true,
            title: true,
            sourcePostId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      assets: assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        structure: asset.structure,
        variableSlots: parseJsonArray(asset.variableSlotsJson),
        transferScope: asset.transferScope,
        usageNote: asset.usageNote,
        tags: parseJsonArray(asset.tagsJson),
        status: asset.status,
        createdAt: asset.createdAt,
        sourceCard: asset.learningCard
          ? {
              learningCardId: asset.learningCard.id,
              title: asset.learningCard.title,
              sourcePostId: asset.learningCard.sourcePostId,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return NextResponse.json({ error: "資産庫の取得に失敗しました" }, { status: 500 });
  }
}
