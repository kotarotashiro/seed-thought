import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { xaiChat } from "@/lib/xai/client";
import {
  buildCollectionPrompt,
  type CollectionOutputKind,
} from "@/lib/ai/collectionPrompt";

const VALID_KINDS = new Set<CollectionOutputKind>([
  "seminar",
  "mini_course",
  "note",
  "newsletter",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  try {
    const body = (await request.json()) as { outputKind?: CollectionOutputKind };
    const outputKind =
      body.outputKind && VALID_KINDS.has(body.outputKind) ? body.outputKind : "seminar";

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            learningCard: {
              include: {
                sourcePost: { include: { classification: true } },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      return NextResponse.json({ error: "コレクションが見つかりません" }, { status: 404 });
    }
    if (collection.items.length === 0) {
      return NextResponse.json(
        { error: "コレクションに学習カードがありません" },
        { status: 400 }
      );
    }

    const prompt = await buildCollectionPrompt({
      collectionTitle: collection.title,
      collectionDescription: collection.description,
      collectionIdea: collection.idea,
      outputKind,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cards: collection.items.map((item: any) => ({
        title: item.learningCard.title,
        summary: item.learningCard.summary,
        coreInsight: item.learningCard.coreInsight,
        manual: item.learningCard.manual,
        userMemo: item.learningCard.userMemo,
        category:
          item.learningCard.sourcePost.classification?.primaryCategory ?? null,
      })),
    });

    const { content: raw } = await xaiChat({
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.4,
    });

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { title: collection.title, body: cleaned };
    }

    const outputJson = JSON.stringify({
      kind: outputKind,
      generatedAt: new Date().toISOString(),
      content: parsed,
    });

    await prisma.collection.update({
      where: { id: collectionId },
      data: { outputJson },
    });

    return NextResponse.json({ outputKind, content: parsed });
  } catch (error) {
    console.error("Failed to generate collection output:", error);
    const message = error instanceof Error ? error.message : "コンテンツ生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
