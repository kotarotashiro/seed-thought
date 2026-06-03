"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpDown, Layers, Plus, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAlert, useConfirm } from "@/components/ui/DialogProvider";

interface CollectionListItem {
  id: string;
  title: string;
  description: string | null;
  outputJson: string | null;
  updatedAt: string;
  items: Array<{
    id: string;
    order: number;
    learningCard: { id: string; title: string; summary: string; status: string };
  }>;
}

interface LearningCardOption {
  id: string;
  title: string;
  summary: string;
  status: string;
  updatedAt: string;
  sourcePost?: {
    classification?: { primaryCategory: string } | null;
  };
}

type SortKey = "date_desc" | "date_asc" | "title_asc" | "category";

const SORT_LABELS: Record<SortKey, string> = {
  date_desc: "新しい順",
  date_asc: "古い順",
  title_asc: "タイトル順",
  category: "カテゴリ順",
};

export default function CollectionsPage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const [collections, setCollections] = useState<CollectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [idea, setIdea] = useState("");
  const [availableCards, setAvailableCards] = useState<LearningCardOption[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date_desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [pendingAutoGenerate, setPendingAutoGenerate] = useState<string[]>([]);
  const [listFilter, setListFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [colRes, cardRes] = await Promise.all([
          fetch("/api/collections"),
          fetch("/api/learning-cards"),
        ]);
        const colData = await colRes.json();
        const cardData = await cardRes.json();
        if (cancelled) return;
        setCollections(colData.collections || []);
        setAvailableCards(cardData.learningCards || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Detect cardId URL params (set by knowhow page when creating a collection from selected cards)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cardIds = params.getAll("cardId");
    if (cardIds.length > 0) {
      setSelectedIds(cardIds);
      setShowForm(true);
      setPendingAutoGenerate(cardIds);
    }
  }, []);

  // Auto-generate title/description once cards are loaded
  useEffect(() => {
    if (pendingAutoGenerate.length > 0 && !loading) {
      generateMeta(pendingAutoGenerate);
      setPendingAutoGenerate([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoGenerate, loading]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? availableCards.filter(
          (c) =>
            c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q)
        )
      : availableCards;

    return [...base].sort((a, b) => {
      switch (sortBy) {
        case "title_asc":
          return a.title.localeCompare(b.title, "ja");
        case "date_asc":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "category": {
          const catA = a.sourcePost?.classification?.primaryCategory ?? "￿";
          const catB = b.sourcePost?.classification?.primaryCategory ?? "￿";
          return catA.localeCompare(catB, "ja");
        }
        case "date_desc":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  }, [availableCards, search, sortBy]);

  const filteredCollections = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description?.toLowerCase() ?? "").includes(q)
    );
  }, [collections, listFilter]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const generateMeta = async (ids: string[]) => {
    if (ids.length === 0) return;
    setAutoGenerating(true);
    try {
      const res = await fetch("/api/collections/generate-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAutoGenerating(false);
    }
  };

  const create = async () => {
    if (!title.trim()) {
      await alert("タイトルを入力してください");
      return;
    }
    if (selectedIds.length === 0) {
      await alert("学習カードを1つ以上選んでください");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          idea: idea.trim(),
          learningCardIds: selectedIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "作成に失敗しました");
      setCollections((prev) => [data.collection, ...prev]);
      setTitle("");
      setDescription("");
      setIdea("");
      setSelectedIds([]);
      setShowForm(false);
    } catch (e) {
      await alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const deleteCollection = async (id: string) => {
    const ok = await confirm({
      message: "このコレクションを削除しますか？",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      setCollections((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      await alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">コレクション</h1>
          <p className="mt-1 text-sm text-text-secondary">
            複数の学習カードを束ねて、セミナー・メール講座・note記事に再構成
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          新規作成
        </Button>
      </div>

      {showForm && (
        <Card padding="lg" className="space-y-4">
          {/* Title */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary">タイトル</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateMeta(selectedIds)}
                loading={autoGenerating}
                loadingLabel="生成中..."
                disabled={selectedIds.length === 0}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                AI自動生成
              </Button>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: AI活用 7日間ミニ講座"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このコレクションの狙い・対象者など"
              rows={2}
              className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          {/* Idea */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              自分のアイディア・視点（任意）
            </label>
            <p className="mb-1.5 text-[11px] text-text-muted">
              保存した投稿の知見と組み合わせたい自分なりの考え・事例・問いかけを書くと、生成コンテンツに独自性が加わります。
            </p>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={"例）AIツールを使いこなす前提として「問いを立てる力」が必要だと感じている。\n自分の経験では〇〇の壁にぶつかる受講者が多い。そこを軸にしたい。"}
              rows={3}
              className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          {/* Card selection */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-text-secondary">
                含める学習カード（{selectedIds.length}件選択中）
              </label>
              <div className="ml-auto flex items-center gap-2">
                {/* Sort */}
                <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1">
                  <ArrowUpDown className="h-3 w-3 text-text-muted" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="bg-transparent text-xs text-text-secondary focus:outline-none"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <option key={k} value={k}>
                        {SORT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="検索"
                    className="rounded-lg border border-border bg-white py-1 pl-7 pr-2 text-xs focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border bg-white p-2">
              {filteredCards.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-text-muted">
                  該当する学習カードがありません
                </p>
              ) : (
                filteredCards.map((card) => (
                  <label
                    key={card.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-border-light"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(card.id)}
                      onChange={() => toggle(card.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-text">{card.title}</p>
                        {card.sourcePost?.classification?.primaryCategory && (
                          <span className="shrink-0 text-[10px] text-text-muted">
                            {card.sourcePost.classification.primaryCategory}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-xs text-text-secondary">{card.summary}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} size="sm">
              キャンセル
            </Button>
            <Button onClick={create} loading={creating} loadingLabel="作成中..." size="sm">
              作成
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-text-muted">読み込み中…</p>
      ) : collections.length === 0 ? (
        <Card className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-border-light">
            <Layers className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm font-semibold text-text">まだコレクションがありません</p>
          <p className="mt-1 text-xs text-text-secondary">
            「新規作成」から、複数のカードを束ねたコンテンツを作れます
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {collections.length > 1 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value)}
                placeholder="タイトル・説明で絞り込む"
                className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-4 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          )}
          {filteredCollections.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">該当するコレクションがありません</p>
          ) : (
            <div className="space-y-3">
              {filteredCollections.map((col) => (
                <Link key={col.id} href={`/collections/${col.id}`} className="block">
                  <Card hoverable className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-text">{col.title}</h2>
                        {col.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                            {col.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void deleteCollection(col.id);
                          }}
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-danger-light hover:text-danger"
                          title="削除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ArrowRight className="h-4 w-4 text-text-muted" />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge>{col.items.length} カード</Badge>
                      {col.outputJson && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-2 py-0.5 text-accent">
                          <Sparkles className="h-3 w-3" />
                          生成済み
                        </span>
                      )}
                      <span className="text-text-muted">
                        更新: {new Date(col.updatedAt).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
