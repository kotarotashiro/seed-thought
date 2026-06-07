"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Network, X as XIcon } from "lucide-react";
import type { KnowledgeMapData, KnowledgeMapNode, KnowledgeMapEdge } from "@/app/api/knowledge-map/route";

// ── カテゴリ別の色定義 ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  "AI活用":       { fill: "#e0f2fe", stroke: "#0ea5e9", text: "#0369a1" },
  "SNS運用":      { fill: "#fce7f3", stroke: "#ec4899", text: "#be185d" },
  "マーケティング": { fill: "#fef3c7", stroke: "#f59e0b", text: "#b45309" },
  "コンテンツ制作": { fill: "#f3e8ff", stroke: "#a855f7", text: "#7e22ce" },
  "LINE運用":     { fill: "#dcfce7", stroke: "#22c55e", text: "#15803d" },
  "セミナー集客":  { fill: "#fff7ed", stroke: "#f97316", text: "#c2410c" },
  "ビジネス":     { fill: "#f1f5f9", stroke: "#64748b", text: "#334155" },
};

const DEFAULT_COLOR = { fill: "#f0fdf4", stroke: "#86efac", text: "#166534" };

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

// ── Fruchterman-Reingold 簡易フォースシミュレーション ───────────────────────
interface NodePosition {
  x: number;
  y: number;
}

function computeLayout(
  nodes: KnowledgeMapNode[],
  edges: KnowledgeMapEdge[],
  width: number,
  height: number,
  iterations = 80
): NodePosition[] {
  const n = nodes.length;
  if (n === 0) return [];

  const area = width * height;
  const k = Math.sqrt(area / n) * 0.8;

  // 初期配置: 外周の円上に均等配置
  const positions: NodePosition[] = nodes.map((_, i) => ({
    x: width / 2 + (width * 0.35) * Math.cos((2 * Math.PI * i) / n),
    y: height / 2 + (height * 0.35) * Math.sin((2 * Math.PI * i) / n),
  }));

  const idToIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const disp: NodePosition[] = nodes.map(() => ({ x: 0, y: 0 }));

  for (let iter = 0; iter < iterations; iter++) {
    const temp = Math.max(1, ((iterations - iter) / iterations) * (width / 5));

    // 反発力（全ノード間）
    for (let i = 0; i < n; i++) {
      disp[i].x = 0;
      disp[i].y = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const dist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
        const repulsion = (k * k) / dist;
        disp[i].x += (dx / dist) * repulsion;
        disp[i].y += (dy / dist) * repulsion;
      }
    }

    // 引力（エッジで結ばれたノード間）
    for (const edge of edges) {
      const ai = idToIndex.get(edge.source);
      const bi = idToIndex.get(edge.target);
      if (ai === undefined || bi === undefined) continue;
      const dx = positions[ai].x - positions[bi].x;
      const dy = positions[ai].y - positions[bi].y;
      const dist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
      const attraction = (dist * dist) / (k * (1 + edge.weight));
      const fx = (dx / dist) * attraction;
      const fy = (dy / dist) * attraction;
      disp[ai].x -= fx;
      disp[ai].y -= fy;
      disp[bi].x += fx;
      disp[bi].y += fy;
    }

    // 変位を適用（温度でキャップ）
    const MARGIN = 60;
    for (let i = 0; i < n; i++) {
      const dispLen = Math.max(0.01, Math.sqrt(disp[i].x ** 2 + disp[i].y ** 2));
      const scale = Math.min(dispLen, temp) / dispLen;
      positions[i].x = Math.max(MARGIN, Math.min(width - MARGIN, positions[i].x + disp[i].x * scale));
      positions[i].y = Math.max(MARGIN, Math.min(height - MARGIN, positions[i].y + disp[i].y * scale));
    }
  }

  return positions;
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export default function KnowledgeMapPage() {
  const [data, setData] = useState<KnowledgeMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [positions, setPositions] = useState<NodePosition[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeMapNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 });

  // ── フォーカスカードの隣接ノードを計算
  const adjacentIds = selectedNode && data
    ? new Set(
        data.edges
          .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
          .flatMap((e) => [e.source, e.target])
      )
    : null;

  const selectedEdges = selectedNode && data
    ? data.edges.filter(
        (e) => e.source === selectedNode.id || e.target === selectedNode.id
      )
    : [];

  // ── データ取得
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/knowledge-map");
        if (!res.ok) throw new Error("データ取得に失敗しました");
        const json = (await res.json()) as KnowledgeMapData;
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── SVGサイズ観察
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSvgSize({
          width: Math.max(400, width),
          height: Math.max(400, Math.min(700, height)),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── レイアウト計算
  useEffect(() => {
    if (!data) return;
    const { width, height } = svgSize;
    const pos = computeLayout(data.nodes, data.edges, width, height);
    setPositions(pos);
  }, [data, svgSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        知識マップを構築中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Network className="mb-4 h-10 w-10 text-text-muted" />
        <p className="text-sm font-semibold text-text">学習カードがまだありません</p>
        <p className="mt-1 text-xs text-text-secondary">
          投稿から学習カードを生成すると、ここに知識のつながりが現れます。
        </p>
      </div>
    );
  }

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col gap-4 sm:h-[calc(100vh-7rem)]">
      {/* ヘッダー */}
      <div className="flex flex-shrink-0 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">知識マップ</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {data.nodes.length}枚のカード・{data.edges.length}本の関連線 — タグが重なるカードをつないでいます
          </p>
        </div>
      </div>

      {/* メイン: グラフ + サイドパネル */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* SVGグラフ */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden rounded-2xl border border-border bg-white"
          style={{ minHeight: 0 }}
        >
          {positions.length === data.nodes.length && (
            <svg
              ref={svgRef}
              width={svgSize.width}
              height={svgSize.height}
              viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
              className="h-full w-full"
            >
              {/* エッジ */}
              {data.edges.map((edge, i) => {
                const ai = data.nodes.findIndex((n) => n.id === edge.source);
                const bi = data.nodes.findIndex((n) => n.id === edge.target);
                if (ai < 0 || bi < 0) return null;
                const a = positions[ai];
                const b = positions[bi];
                const isActive =
                  selectedNode &&
                  (edge.source === selectedNode.id || edge.target === selectedNode.id);
                const isHovered =
                  hoveredNode &&
                  (edge.source === hoveredNode || edge.target === hoveredNode);
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={isActive || isHovered ? "#6366f1" : "#e2e8f0"}
                    strokeWidth={isActive ? edge.weight + 1 : isHovered ? 1.5 : 1}
                    opacity={
                      selectedNode
                        ? isActive
                          ? 0.9
                          : 0.08
                        : hoveredNode
                        ? isHovered
                          ? 0.7
                          : 0.15
                        : 0.35
                    }
                  />
                );
              })}

              {/* ノード */}
              {data.nodes.map((node, i) => {
                if (i >= positions.length) return null;
                const pos = positions[i];
                const color = getCategoryColor(node.category);
                const isSelected = selectedNode?.id === node.id;
                const isAdjacent = adjacentIds?.has(node.id);
                const isHov = hoveredNode === node.id;
                const dimmed = selectedNode
                  ? !isSelected && !isAdjacent
                  : false;

                const r = isSelected ? 28 : isAdjacent ? 22 : isHov ? 20 : 16;

                // タイトルを短縮表示
                const label = node.title.length > 12 ? node.title.slice(0, 11) + "…" : node.title;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x},${pos.y})`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedNode(isSelected ? null : node)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <circle
                      r={r}
                      fill={color.fill}
                      stroke={isSelected ? color.stroke : isHov ? color.stroke : "#d1d5db"}
                      strokeWidth={isSelected ? 2.5 : isHov ? 1.5 : 1}
                      opacity={dimmed ? 0.2 : 1}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={isSelected ? 9 : 8}
                      fill={dimmed ? "#94a3b8" : color.text}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* 凡例 */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {Array.from(new Set(data.nodes.map((n) => n.category))).map((cat) => {
              const color = getCategoryColor(cat);
              return (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: color.fill, color: color.text, border: `1px solid ${color.stroke}` }}
                >
                  {cat}
                </span>
              );
            })}
          </div>
        </div>

        {/* サイドパネル: 選択カードの詳細 + 関連カード */}
        {selectedNode && (
          <div className="w-72 flex-shrink-0 overflow-y-auto rounded-2xl border border-border bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 className="text-sm font-bold text-text leading-snug">{selectedNode.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="flex-shrink-0 rounded-md p-0.5 text-text-muted hover:bg-border-light"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              カテゴリ
            </p>
            <span
              className="mb-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: getCategoryColor(selectedNode.category).fill,
                color: getCategoryColor(selectedNode.category).text,
                border: `1px solid ${getCategoryColor(selectedNode.category).stroke}`,
              }}
            >
              {selectedNode.category}
            </span>

            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              タグ
            </p>
            <div className="mb-3 flex flex-wrap gap-1">
              {selectedNode.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-border-light px-2 py-0.5 text-[10px] text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>

            <Link
              href={`/posts/${selectedNode.postId}/learning`}
              className="mb-4 block rounded-xl border border-accent/30 bg-accent-light/40 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent-light/70 text-center transition-colors"
            >
              学習カードを開く →
            </Link>

            {selectedEdges.length > 0 && (
              <>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  関連するカード ({selectedEdges.length}件)
                </p>
                <div className="space-y-2">
                  {selectedEdges
                    .sort((a, b) => b.weight - a.weight)
                    .slice(0, 10)
                    .map((edge) => {
                      const otherId =
                        edge.source === selectedNode.id ? edge.target : edge.source;
                      const other = nodeById.get(otherId);
                      if (!other) return null;
                      const color = getCategoryColor(other.category);
                      return (
                        <div
                          key={otherId}
                          className="cursor-pointer rounded-xl border border-border p-2.5 hover:border-accent/30 hover:bg-accent-light/20 transition-colors"
                          onClick={() => setSelectedNode(other)}
                        >
                          <p className="text-xs font-medium text-text leading-snug">{other.title}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {edge.sharedTags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                                style={{ backgroundColor: color.fill, color: color.text }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
