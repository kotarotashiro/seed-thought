import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export interface CollectionSuggestion {
  key: string;          // クラスタの識別子（カテゴリ名等）
  label: string;        // 表示ラベル（例: 「AI活用」まとめ）
  cardIds: string[];    // 対象 LearningCard の ID 配列
  count: number;
  sampleTitles: string[];
}

const MIN_CARDS = 5;    // おすすめを出す最低枚数
const TOP_N = 3;        // 上位何件返すか

export async function GET() {
  try {
    // 1. コレクションに既に含まれているカードIDを取得
    const collectionItems = await prisma.collectionItem.findMany({
      select: { learningCardId: true },
    });
    const alreadyInCollection = new Set(
      collectionItems.map((item) => item.learningCardId)
    );

    // 2. 全学習カードをカテゴリ付きで取得
    const cards = await prisma.learningCard.findMany({
      select: {
        id: true,
        title: true,
        sourcePost: {
          select: {
            classification: {
              select: { primaryCategory: true },
            },
          },
        },
      },
    });

    // 3. 未コレクション化のカードのみを対象にカテゴリでクラスタリング
    const clusterMap = new Map<
      string,
      { cardIds: string[]; titles: string[] }
    >();

    for (const card of cards) {
      if (alreadyInCollection.has(card.id)) continue;
      const category =
        card.sourcePost.classification?.primaryCategory ?? "未分類";
      const existing = clusterMap.get(category) ?? {
        cardIds: [],
        titles: [],
      };
      existing.cardIds.push(card.id);
      existing.titles.push(card.title);
      clusterMap.set(category, existing);
    }

    // 4. 閾値以上のクラスタを提案化し、件数降順で上位N件返す
    const suggestions: CollectionSuggestion[] = [];
    for (const [category, { cardIds, titles }] of clusterMap.entries()) {
      if (cardIds.length < MIN_CARDS) continue;
      suggestions.push({
        key: category,
        label: `「${category}」まとめ`,
        cardIds,
        count: cardIds.length,
        sampleTitles: titles.slice(0, 3),
      });
    }

    suggestions.sort((a, b) => b.count - a.count);

    return NextResponse.json({ suggestions: suggestions.slice(0, TOP_N) });
  } catch (error) {
    console.error("[collections/suggestions]", error);
    return NextResponse.json(
      { error: "おすすめの取得に失敗しました" },
      { status: 500 }
    );
  }
}
