import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export interface KnowledgeMapNode {
  id: string;        // LearningCard.id
  postId: string;    // Post.id
  title: string;
  summary: string;
  category: string;
  tags: string[];
}

export interface KnowledgeMapEdge {
  source: string;    // LearningCard.id
  target: string;    // LearningCard.id
  weight: number;    // shared tag count
  sharedTags: string[];
}

export interface KnowledgeMapData {
  nodes: KnowledgeMapNode[];
  edges: KnowledgeMapEdge[];
}

export async function GET(): Promise<NextResponse> {
  try {
    const cards = await prisma.learningCard.findMany({
      include: {
        sourcePost: {
          include: { classification: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200, // 多すぎる場合は上位200件に絞る
    });

    const nodes: KnowledgeMapNode[] = cards.map((card) => ({
      id: card.id,
      postId: card.sourcePostId,
      title: card.title,
      summary: card.summary,
      category: card.sourcePost.classification?.primaryCategory ?? "その他",
      tags: card.sourcePost.classification
        ? (JSON.parse(card.sourcePost.classification.tagsJson || "[]") as string[])
        : [],
    }));

    // タグが重複するカード間にエッジを張る（weight = 共通タグ数）
    const edges: KnowledgeMapEdge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const sharedTags = a.tags.filter((t) => b.tags.includes(t));
        if (sharedTags.length > 0) {
          edges.push({
            source: a.id,
            target: b.id,
            weight: sharedTags.length,
            sharedTags,
          });
        }
      }
    }

    return NextResponse.json({ nodes, edges } satisfies KnowledgeMapData);
  } catch (error) {
    console.error("Knowledge map failed:", error);
    return NextResponse.json({ error: "知識マップの生成に失敗しました" }, { status: 500 });
  }
}
