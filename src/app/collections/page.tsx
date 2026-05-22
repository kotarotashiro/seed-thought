"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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
  sourcePost?: {
    classification?: { primaryCategory: string } | null;
  };
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [availableCards, setAvailableCards] = useState<LearningCardOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableCards;
    return availableCards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q)
    );
  }, [availableCards, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const create = async () => {
    if (!title.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    if (selectedIds.length === 0) {
      alert("学習カードを1つ以上選んでください");
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
          learningCardIds: selectedIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "作成に失敗しました");
      setCollections((prev) => [data.collection, ...prev]);
      setTitle("");
      setDescription("");
      setSelectedIds([]);
      setShowForm(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
            <Layers className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text sm:text-2xl">コレクション</h1>
            <p className="mt-1 text-xs text-text-secondary">
              複数の学習カードを束ねて、セミナー・メール講座・note記事に再構成
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          新規作成
        </Button>
      </div>

      {showForm && (
        <Card padding="lg" className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: AI活用 7日間ミニ講座"
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このコレクションの狙い・対象者など"
              rows={2}
              className="w-full resize-y rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary">
                含める学習カード（{selectedIds.length}件選択中）
              </label>
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
                      <p className="truncate text-sm font-medium text-text">{card.title}</p>
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
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-border-light">
            <Layers className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm font-semibold text-text">まだコレクションがありません</p>
          <p className="mt-1 text-xs text-text-secondary">
            「新規作成」から、複数のカードを束ねたコンテンツを作れます
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {collections.map((col) => (
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
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-text-muted" />
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
  );
}
