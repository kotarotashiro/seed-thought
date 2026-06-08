"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Maximize2, Minus, Network, Plus, X as XIcon } from "lucide-react";
import type { KnowledgeMapData, KnowledgeMapNode, KnowledgeMapEdge } from "@/app/api/knowledge-map/route";

// ── カテゴリ別の色 ─────────────────────────────────────────────────────────────
// カテゴリ数が多く（30種類前後）固定色だけでは大半が同色になり見分けられない。
// 出現頻度の高い順にパレットを割り当て、残りはニュートラルにする。
type Color = { fill: string; stroke: string; text: string };

const PALETTE: Color[] = [
  { fill: "#e0f2fe", stroke: "#38bdf8", text: "#0369a1" }, // sky
  { fill: "#fce7f3", stroke: "#f472b6", text: "#be185d" }, // pink
  { fill: "#fef3c7", stroke: "#fbbf24", text: "#b45309" }, // amber
  { fill: "#f3e8ff", stroke: "#c084fc", text: "#7e22ce" }, // violet
  { fill: "#dcfce7", stroke: "#4ade80", text: "#15803d" }, // green
  { fill: "#ffedd5", stroke: "#fb923c", text: "#c2410c" }, // orange
  { fill: "#ccfbf1", stroke: "#2dd4bf", text: "#0f766e" }, // teal
  { fill: "#e0e7ff", stroke: "#818cf8", text: "#4338ca" }, // indigo
  { fill: "#ffe4e6", stroke: "#fb7185", text: "#be123c" }, // rose
  { fill: "#ecfccb", stroke: "#a3e635", text: "#4d7c0f" }, // lime
  { fill: "#cffafe", stroke: "#22d3ee", text: "#0e7490" }, // cyan
  { fill: "#fae8ff", stroke: "#e879f9", text: "#a21caf" }, // fuchsia
];
const NEUTRAL: Color = { fill: "#f1f5f9", stroke: "#cbd5e1", text: "#475569" };

function buildColorMap(nodes: KnowledgeMapNode[]): Map<string, Color> {
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const map = new Map<string, Color>();
  ranked.forEach(([cat], i) => map.set(cat, i < PALETTE.length ? PALETTE[i] : NEUTRAL));
  return map;
}

// ── レイアウト（力学モデル + 衝突回避） ────────────────────────────────────────
interface NodePosition {
  x: number;
  y: number;
}

function computeLayout(
  nodes: KnowledgeMapNode[],
  edges: KnowledgeMapEdge[],
  size: number,
  iterations = 160
): NodePosition[] {
  const n = nodes.length;
  if (n === 0) return [];

  const k = Math.sqrt((size * size) / n) * 1.1; // 理想ノード間距離
  const positions: NodePosition[] = nodes.map((_, i) => ({
    x: size / 2 + size * 0.4 * Math.cos((2 * Math.PI * i) / n),
    y: size / 2 + size * 0.4 * Math.sin((2 * Math.PI * i) / n),
  }));

  const idToIndex = new Map(nodes.map((nd, i) => [nd.id, i]));
  const disp: NodePosition[] = nodes.map(() => ({ x: 0, y: 0 }));
  const cx = size / 2;
  const cy = size / 2;
  // 中心への引力。境界クランプ（端へのノード整列を招く）の代わりに使い、
  // 弱く繋がったノードが無限に飛んでいくのを防いでコンパクトな円盤にまとめる。
  const GRAVITY = 0.35;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = Math.max(1, ((iterations - iter) / iterations) * (size / 6));

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

    for (let i = 0; i < n; i++) {
      disp[i].x += (cx - positions[i].x) * GRAVITY;
      disp[i].y += (cy - positions[i].y) * GRAVITY;
    }

    for (let i = 0; i < n; i++) {
      const len = Math.max(0.01, Math.sqrt(disp[i].x ** 2 + disp[i].y ** 2));
      const scale = Math.min(len, temp) / len;
      positions[i].x += disp[i].x * scale;
      positions[i].y += disp[i].y * scale;
    }
  }

  // ── 正規化: 力学計算後の絶対スケールはGRAVITYや接続数で大きく変わるため不定。
  // 描画前に固定サイズへ収め直し、ノード半径(world座標)が常に見やすい比率になるようにする。
  // これをしないと、広がった配置をフィット表示した時にノードが点のように潰れてしまう。
  {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const p of positions) {
      mnx = Math.min(mnx, p.x);
      mny = Math.min(mny, p.y);
      mxx = Math.max(mxx, p.x);
      mxy = Math.max(mxy, p.y);
    }
    const pad = size * 0.06;
    const s = (size - pad * 2) / Math.max(mxx - mnx || 1, mxy - mny || 1);
    const offX = (size - (mxx - mnx) * s) / 2;
    const offY = (size - (mxy - mny) * s) / 2;
    for (const p of positions) {
      p.x = offX + (p.x - mnx) * s;
      p.y = offY + (p.y - mny) * s;
    }
  }

  // ── 衝突回避: 円が重ならないよう繰り返し押し広げる（ラベルの被りを防ぐ最重要処理）
  const MIN_GAP = 46;
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = positions[j].x - positions[i].x;
        let dy = positions[j].y - positions[i].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_GAP) {
          if (dist < 0.5) {
            // 完全に重なったノードは方向ベクトルが消えて押し離せない。
            // インデックス由来の決定的な角度で散らす。
            const ang = ((i * 49297 + j * 233280) % 360) * (Math.PI / 180);
            dx = Math.cos(ang);
            dy = Math.sin(ang);
            dist = 1;
          }
          const push = (MIN_GAP - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          positions[i].x -= ux * push;
          positions[i].y -= uy * push;
          positions[j].x += ux * push;
          positions[j].y += uy * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  return positions;
}

// ── ビュー変換（ズーム/パン） ──────────────────────────────────────────────────
interface View {
  x: number;
  y: number;
  k: number;
}
const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

// ── メインコンポーネント ──────────────────────────────────────────────────────
export default function KnowledgeMapPage() {
  const [data, setData] = useState<KnowledgeMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [positions, setPositions] = useState<NodePosition[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeMapNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // ジェスチャ管理
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; cx: number; cy: number; view: View } | null>(null);
  const draggedRef = useRef(false);
  const interactedRef = useRef(false);

  // レイアウト座標空間（ノード数に応じて広げる）。ビューポートとは独立。
  const layoutSize = useMemo(() => {
    const n = data?.nodes.length ?? 0;
    return Math.max(700, Math.min(2600, Math.round(Math.sqrt(Math.max(1, n)) * 150)));
  }, [data]);

  const colorMap = useMemo(() => (data ? buildColorMap(data.nodes) : new Map<string, Color>()), [data]);
  const getColor = useCallback((cat: string) => colorMap.get(cat) ?? NEUTRAL, [colorMap]);

  const nodeIndex = useMemo(
    () => new Map((data?.nodes ?? []).map((n, i) => [n.id, i])),
    [data]
  );

  // 全ノードを次数（関連の強さ）順に並べる。ラベルはこの優先順で配置し、
  // 重なるものは描画時に間引く。俯瞰では主要ノードだけ、ズームインすると
  // ノードが画面上で離れていくぶん自然と表示ラベルが増える。
  const labelOrder = useMemo(() => {
    if (!data) return [] as string[];
    const deg = new Map<string, number>();
    for (const n of data.nodes) deg.set(n.id, 0);
    for (const e of data.edges) {
      deg.set(e.source, (deg.get(e.source) ?? 0) + e.weight);
      deg.set(e.target, (deg.get(e.target) ?? 0) + e.weight);
    }
    return [...deg.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [data]);

  const adjacentIds = useMemo(() => {
    if (!selectedNode || !data) return null;
    return new Set(
      data.edges
        .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
        .flatMap((e) => [e.source, e.target])
    );
  }, [selectedNode, data]);

  const selectedEdges = useMemo(() => {
    if (!selectedNode || !data) return [];
    return data.edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id);
  }, [selectedNode, data]);

  // ── データ取得
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/knowledge-map");
        if (!res.ok) throw new Error("データ取得に失敗しました");
        setData((await res.json()) as KnowledgeMapData);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── コンテナサイズ観察
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width: Math.max(200, width), height: Math.max(200, height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── レイアウト計算（データ確定時に一度だけ。リサイズで再計算しない）
  useEffect(() => {
    if (!data) return;
    setPositions(computeLayout(data.nodes, data.edges, layoutSize));
    interactedRef.current = false;
  }, [data, layoutSize]);

  // ── ノード全体が収まるようビューをフィット
  const fitView = useCallback(() => {
    if (positions.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of positions) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = 60;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const { width, height } = containerSize;
    const k = clampScale(Math.min(width / w, height / h));
    const x = width / 2 - (minX + maxX) / 2 * k;
    const y = height / 2 - (minY + maxY) / 2 * k;
    setView({ x, y, k });
  }, [positions, containerSize]);

  // 初回レイアウト後 / リサイズ時（ユーザー操作前のみ）に自動フィット
  useEffect(() => {
    if (positions.length === 0) return;
    if (interactedRef.current) return;
    fitView();
  }, [positions, containerSize, fitView]);

  // ── ホイールズーム（カーソル中心）
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setView((v) => {
      const nk = clampScale(v.k * Math.exp(-e.deltaY * 0.0015));
      const ratio = nk / v.k;
      interactedRef.current = true;
      return { k: nk, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, []);

  const zoomByButton = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const px = rect ? rect.width / 2 : 0;
    const py = rect ? rect.height / 2 : 0;
    setView((v) => {
      const nk = clampScale(v.k * factor);
      const ratio = nk / v.k;
      interactedRef.current = true;
      return { k: nk, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  };

  // ── ポインタ（パン + ピンチ、マウス/タッチ共通）
  const relPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    draggedRef.current = false;

    if (pointersRef.current.size === 1) {
      panRef.current = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const mid = relPoint((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      pinchRef.current = { dist: Math.hypot(dx, dy), cx: mid.x, cy: mid.y, view: { ...view } };
      panRef.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const start = pinchRef.current;
      const nk = clampScale(start.view.k * (dist / start.dist));
      const ratio = nk / start.view.k;
      interactedRef.current = true;
      draggedRef.current = true;
      setView({ k: nk, x: start.cx - (start.cx - start.view.x) * ratio, y: start.cy - (start.cy - start.view.y) * ratio });
      return;
    }

    if (panRef.current) {
      // 値を先に取り出す。setView の更新関数が遅れて実行される頃には
      // pointerup で panRef.current が null になっている場合があるため、
      // 更新関数の中で panRef を参照すると null 参照で落ちる。
      const { startX, startY, viewX, viewY } = panRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        draggedRef.current = true;
        interactedRef.current = true;
      }
      setView((v) => ({ ...v, x: viewX + dx, y: viewY + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;
  };

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
  const truncate = (t: string) => (t.length > 14 ? t.slice(0, 13) + "…" : t);

  // ── 俯瞰時のラベルを画面座標で重なりなく配置する ──────────────────────────
  // ラベルはズームに依らず一定サイズ（後述の 1/view.k 補正）で描くので、
  // 重なり判定も画面ピクセルで行う。重なるものは間引いて、読める数だけ残す。
  const labeledIds = new Set<string>();
  if (!selectedNode && positions.length === data.nodes.length) {
    const FS = 12;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const id of labelOrder) {
      const idx = nodeIndex.get(id);
      const node = idx != null ? data.nodes[idx] : undefined;
      if (idx == null || !node) continue;
      const p = positions[idx];
      const sx = view.x + p.x * view.k;
      const sy = view.y + p.y * view.k;
      if (sx < 0 || sx > containerSize.width || sy < 0 || sy > containerSize.height) continue;
      const label = truncate(node.title);
      // MARGIN ぶん広めに当たり判定して、俯瞰時にラベルが詰まりすぎないようにする。
      // ズームインするとノードが画面上で離れ、自然と表示ラベルが増えていく。
      const MARGIN = 7;
      const w = Math.max(24, label.length * FS * 0.62) + MARGIN * 2;
      const rect = { x: sx - w / 2, y: sy + 13 * view.k + 3, w, h: FS + 4 + MARGIN };
      const hit = placed.some(
        (q) => !(rect.x + rect.w < q.x || q.x + q.w < rect.x || rect.y + rect.h < q.y || q.y + q.h < rect.y)
      );
      if (hit) continue;
      placed.push(rect);
      labeledIds.add(id);
    }
  }

  // 凡例: パレット割り当て済みカテゴリのみ（頻度順）
  const legendCats = [...colorMap.entries()]
    .filter(([, c]) => c !== NEUTRAL)
    .sort((a, b) => {
      const ca = data.nodes.filter((n) => n.category === a[0]).length;
      const cb = data.nodes.filter((n) => n.category === b[0]).length;
      return cb - ca;
    });

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">知識マップ</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {data.nodes.length}枚のカード・{data.edges.length}本の関連線 — タグが重なるカードをつないでいます
        </p>
      </div>

      <div className="relative flex gap-4">
        {/* グラフ */}
        <div
          ref={containerRef}
          className="relative h-[62vh] min-h-[380px] w-full flex-1 touch-none select-none overflow-hidden rounded-2xl border border-border bg-white sm:h-[calc(100vh-11rem)]"
        >
          {positions.length === data.nodes.length && (
            <svg
              width={containerSize.width}
              height={containerSize.height}
              viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
              className="h-full w-full"
              style={{ cursor: panRef.current ? "grabbing" : "grab" }}
              onWheel={handleWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={(e) => {
                // 背景クリック（ノード以外）で選択解除
                if (e.target === e.currentTarget && !draggedRef.current) setSelectedNode(null);
              }}
            >
              <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                {/* エッジ */}
                {data.edges.map((edge, i) => {
                  const ai = data.nodes.findIndex((n) => n.id === edge.source);
                  const bi = data.nodes.findIndex((n) => n.id === edge.target);
                  if (ai < 0 || bi < 0) return null;
                  const a = positions[ai];
                  const b = positions[bi];
                  const isActive =
                    selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);
                  const isHovered =
                    hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={isActive || isHovered ? "#6366f1" : "#cbd5e1"}
                      strokeWidth={isActive ? edge.weight + 1 : isHovered ? 1.5 : 1}
                      opacity={
                        selectedNode ? (isActive ? 0.9 : 0.05) : hoveredNode ? (isHovered ? 0.7 : 0.12) : 0.3
                      }
                    />
                  );
                })}

                {/* ノード */}
                {data.nodes.map((node, i) => {
                  if (i >= positions.length) return null;
                  const pos = positions[i];
                  const color = getColor(node.category);
                  const isSelected = selectedNode?.id === node.id;
                  const isAdjacent = adjacentIds?.has(node.id);
                  const isHov = hoveredNode === node.id;
                  const dimmed = selectedNode ? !isSelected && !isAdjacent : false;
                  const r = isSelected ? 22 : isAdjacent ? 17 : isHov ? 16 : 13;
                  const showLabel = isSelected || isAdjacent || isHov || labeledIds.has(node.id);
                  // ラベルはズームに依らず一定の画面サイズで描く（1/view.k で補正）。
                  const inv = 1 / view.k;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x},${pos.y})`}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (draggedRef.current) return;
                        setSelectedNode(isSelected ? null : node);
                      }}
                      onPointerEnter={() => setHoveredNode(node.id)}
                      onPointerLeave={() => setHoveredNode((h) => (h === node.id ? null : h))}
                    >
                      <circle
                        r={r}
                        fill={color.fill}
                        stroke={isSelected || isHov ? color.stroke : "#d1d5db"}
                        strokeWidth={isSelected ? 2.5 : isHov ? 1.5 : 1}
                        opacity={dimmed ? 0.25 : 1}
                      />
                      {showLabel && (
                        <text
                          y={r + 6 * inv}
                          textAnchor="middle"
                          fontSize={(isSelected ? 13 : 12) * inv}
                          fontWeight={isSelected || isAdjacent ? 600 : 500}
                          fill={dimmed ? "#cbd5e1" : "#334155"}
                          stroke="#ffffff"
                          strokeWidth={3.5 * inv}
                          strokeLinejoin="round"
                          style={{ paintOrder: "stroke", pointerEvents: "none", userSelect: "none" }}
                        >
                          {truncate(node.title)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {/* ズームコントロール */}
          <div className="absolute right-3 top-3 flex flex-col gap-1.5">
            <button
              type="button"
              aria-label="拡大"
              onClick={() => zoomByButton(1.3)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white/95 text-text-secondary shadow-sm hover:bg-border-light hover:text-text"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="縮小"
              onClick={() => zoomByButton(1 / 1.3)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white/95 text-text-secondary shadow-sm hover:bg-border-light hover:text-text"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="全体表示"
              onClick={() => {
                interactedRef.current = false;
                fitView();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white/95 text-text-secondary shadow-sm hover:bg-border-light hover:text-text"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          {/* 操作ヒント */}
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] text-text-muted">
            ドラッグで移動・ピンチ / ホイールで拡大・ノードをタップで詳細
          </div>

          {/* 凡例 */}
          {legendCats.length > 0 && (
            <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5 overflow-hidden">
              {legendCats.map(([cat, color]) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: color.fill, color: color.text, border: `1px solid ${color.stroke}` }}
                >
                  {cat}
                </span>
              ))}
              {colorMap.size > legendCats.length && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: NEUTRAL.fill, color: NEUTRAL.text, border: `1px solid ${NEUTRAL.stroke}` }}
                >
                  その他
                </span>
              )}
            </div>
          )}
        </div>

        {/* 詳細パネル: モバイルはボトムシート / sm以上はサイドカラム */}
        {selectedNode && (
          <>
            {/* モバイル用バックドロップ */}
            <div className="fixed inset-0 z-30 bg-black/30 sm:hidden" onClick={() => setSelectedNode(null)} />
            <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:static sm:z-auto sm:max-h-none sm:w-72 sm:flex-shrink-0 sm:self-start sm:rounded-2xl sm:border sm:p-4 sm:pb-4 sm:shadow-none">
              <div className="mb-3 flex items-start justify-between gap-2">
                <h2 className="text-sm font-bold leading-snug text-text">{selectedNode.title}</h2>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="flex-shrink-0 rounded-md p-0.5 text-text-muted hover:bg-border-light"
                  aria-label="閉じる"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">カテゴリ</p>
              <span
                className="mb-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: getColor(selectedNode.category).fill,
                  color: getColor(selectedNode.category).text,
                  border: `1px solid ${getColor(selectedNode.category).stroke}`,
                }}
              >
                {selectedNode.category}
              </span>

              {selectedNode.tags.length > 0 && (
                <>
                  <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-text-muted">タグ</p>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {selectedNode.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-border-light px-2 py-0.5 text-[10px] text-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <Link
                href={`/posts/${selectedNode.postId}/learning`}
                className="mb-4 block rounded-xl border border-accent/30 bg-accent-light/40 px-3 py-2 text-center text-xs font-semibold text-accent transition-colors hover:bg-accent-light/70"
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
                      .slice()
                      .sort((a, b) => b.weight - a.weight)
                      .slice(0, 10)
                      .map((edge) => {
                        const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                        const other = nodeById.get(otherId);
                        if (!other) return null;
                        const color = getColor(other.category);
                        return (
                          <div
                            key={otherId}
                            className="cursor-pointer rounded-xl border border-border p-2.5 transition-colors hover:border-accent/30 hover:bg-accent-light/20"
                            onClick={() => setSelectedNode(other)}
                          >
                            <p className="text-xs font-medium leading-snug text-text">{other.title}</p>
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
          </>
        )}
      </div>
    </div>
  );
}
