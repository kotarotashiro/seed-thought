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

    // タグが重複するカード間の候補エッジを全て計算（weight = 共通タグ数）
    const allEdges: KnowledgeMapEdge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const sharedTags = a.tags.filter((t) => b.tags.includes(t));
        if (sharedTags.length > 0) {
          allEdges.push({
            source: a.id,
            target: b.id,
            weight: sharedTags.length,
            sharedTags,
          });
        }
      }
    }

    // ── 「毛玉化」を防ぐためエッジを間引く ──────────────────────────────
    // 1枚のカードが共通タグを1つ持つだけで全カードと繋がると、関連線が
    // 数百本に膨れ上がり何も読めなくなる。各ノードについて結びつきの強い
    // 上位 MAX_EDGES_PER_NODE 本だけを残し、その和集合を採用する。
    // これで「弱いつながり」が消え、本当に近いカードのクラスタだけが残る。
    const MAX_EDGES_PER_NODE = 5;
    const byNode = new Map<string, KnowledgeMapEdge[]>();
    for (const e of allEdges) {
      (byNode.get(e.source) ?? byNode.set(e.source, []).get(e.source)!).push(e);
      (byNode.get(e.target) ?? byNode.set(e.target, []).get(e.target)!).push(e);
    }
    const kept = new Set<string>();
    const edges: KnowledgeMapEdge[] = [];
    for (const list of byNode.values()) {
      list
        .sort((a, b) => b.weight - a.weight)
        .slice(0, MAX_EDGES_PER_NODE)
        .forEach((e) => {
          const key = `${e.source}|${e.target}`;
          if (!kept.has(key)) {
            kept.add(key);
            edges.push(e);
          }
        });
    }

    return NextResponse.json({ nodes, edges } satisfies KnowledgeMapData);
  } catch (error) {
    console.error("Knowledge map failed:", error);
    return NextResponse.json({ error: "知識マップの生成に失敗しました" }, { status: 500 });
  }
}
