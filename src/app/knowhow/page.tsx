"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckSquare,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { Badge, LearningStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAlert, useConfirm } from "@/components/ui/DialogProvider";

interface LearningCardItem {
  id: string;
  title: string;
  summary: string;
  coreInsight: string;
  status: "draft" | "saved";
  updatedAt: string;
  userMemo?: string | null;
  sourcePost: {
    id: string;
    text: string;
    sourceUrl?: string | null;
    authorName?: string | null;
    authorUsername?: string | null;
    classification?: {
      primaryCategory: string;
      postType: string;
    } | null;
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export default function KnowhowPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [cards, setCards] = useState<LearningCardItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildParams = useCallback(
    (extra?: { cursor?: string }) => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (selectedCategory) params.set("category", selectedCategory);
      if (extra?.cursor) params.set("cursor", extra.cursor);
      return params;
    },
    [searchQuery, selectedCategory]
  );

  // Fetch the first page whenever filters change.
  useEffect(() => {
    let cancelled = false;

    async function fetchFirstPage() {
      if (!cancelled) {
        setLoading(true);
        setCards([]);
        setNextCursor(null);
      }
      try {
        const res = await fetch(`/api/learning-cards?${buildParams()}`);
        const data = await res.json();
        if (cancelled) return;
        setCards(data.learningCards || []);
        setNextCursor(data.nextCursor ?? null);
        if (typeof data.total === "number") setTotal(data.total);
        if (Array.isArray(data.categories)) setCategories(data.categories);
      } catch (error) {
        console.error("Failed to fetch learning cards:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFirstPage();
    return () => {
      cancelled = true;
    };
  }, [buildParams]);

  const loadMore = useCallback(
    async (cursor: string) => {
      if (loadingMore) return;
      setLoadingMore(true);
      try {
        const res = await fetch(`/api/learning-cards?${buildParams({ cursor })}`);
        const data = await res.json();
        setCards((prev) => [...prev, ...(data.learningCards || [])]);
        setNextCursor(data.nextCursor ?? null);
      } catch (error) {
        console.error("Failed to load more learning cards:", error);
      } finally {
        setLoadingMore(false);
      }
    },
    [loadingMore, buildParams]
  );

  useEffect(() => {
    if (!nextCursor || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor) loadMore(nextCursor);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  const hasActiveFilter = Boolean(searchQuery.trim() || selectedCategory);
  const allFilteredSelected =
    cards.length > 0 && cards.every((c) => selectedIds.has(c.id));

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleCard(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map((c) => c.id)));
    }
  }

  function handleCreateCollection() {
    const ids = Array.from(selectedIds);
    const params = new URLSearchParams();
    ids.forEach((id) => params.append("cardId", id));
    router.push(`/collections?${params.toString()}`);
  }

  async function handleDelete(ids: string[]) {
    if (ids.length === 0) return;
    const msg =
      ids.length === 1
        ? "この学習カードを削除しますか？"
        : `選択した${ids.length}件の学習カードを削除しますか？`;
    const ok = await confirm({ message: msg, confirmLabel: "削除する", variant: "danger" });
    if (!ok) return;
    setDeleting(true);
    try {
      await fetch("/api/learning-cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setCards((prev) => prev.filter((c) => !ids.includes(c.id)));
      setTotal((prev) => (prev === null ? prev : Math.max(0, prev - ids.length)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">学びメモ</h1>
            <p className="text-sm text-text-secondary">
              {total !== null ? `${total}件のメモ` : `${cards.length}件のメモ`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={selectMode ? "primary" : "secondary"}
            onClick={toggleSelectMode}
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            {selectMode ? "選択を終了" : "選択"}
          </Button>
          <Link href="/posts">
            <Button variant="secondary">
              保存一覧へ
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="学習カードを検索..."
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-4 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <select
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <option value="">すべてのカテゴリ</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {selectMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-4 py-3">
          <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
            {allFilteredSelected ? (
              <CheckSquare className="h-4 w-4 mr-1.5 text-accent" />
            ) : (
              <Square className="h-4 w-4 mr-1.5 text-text-muted" />
            )}
            全選択
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={handleCreateCollection}
            >
              <Layers className="h-4 w-4 mr-1.5" />
              コレクション作成 ({selectedIds.size})
            </Button>
            <ExportButton ids={Array.from(selectedIds)} format="zip" />
            <ExportButton ids={Array.from(selectedIds)} format="bundle" />
            <Button
              variant="danger"
              size="sm"
              disabled={selectedIds.size === 0 || deleting}
              onClick={() => handleDelete(Array.from(selectedIds))}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              削除 ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item} className="animate-pulse">
              <div className="mb-3 h-5 w-2/3 rounded bg-border-light" />
              <div className="mb-2 h-3 w-full rounded bg-border-light" />
              <div className="h-3 w-4/5 rounded bg-border-light" />
            </Card>
          ))}
        </div>
      ) : cards.length === 0 && hasActiveFilter ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-border">
          <p className="text-sm text-text-secondary">該当するメモが見つかりませんでした</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <BookOpen className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text mb-2">学びメモがありません</h3>
          <p className="text-sm text-text-secondary mb-4">
            保存した投稿の「学ぶ」から、投稿をメモに変換できます。
          </p>
          <Link href="/posts">
            <Button>保存した投稿を見る</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => {
            const category = card.sourcePost.classification?.primaryCategory || "未分類";
            const isSelected = selectedIds.has(card.id);
            return (
              <Card
                key={card.id}
                hoverable={selectMode}
                className={`flex flex-col gap-4 ${selectMode && isSelected ? "ring-2 ring-accent" : ""}`}
                onClick={selectMode ? () => toggleCard(card.id) : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {selectMode && (
                      <div className="mb-2 flex items-center gap-2">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 flex-shrink-0 text-accent" />
                        ) : (
                          <Square className="h-4 w-4 flex-shrink-0 text-text-muted" />
                        )}
                      </div>
                    )}
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <LearningStatusBadge learningCard={card} />
                      <Badge>{category}</Badge>
                    </div>
                    <h2 className="line-clamp-2 text-base font-bold text-text">{card.title}</h2>
                  </div>
                  {!selectMode && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {card.sourcePost.sourceUrl && (
                        <a
                          href={card.sourcePost.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="sm" title="元投稿を開く">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="削除"
                        onClick={(e) => { e.stopPropagation(); handleDelete([card.id]); }}
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {card.summary}
                </p>

                <div className="rounded-xl bg-border-light px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-accent" />
                    <p className="text-sm font-medium text-text">中心洞察</p>
                  </div>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {card.coreInsight}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(card.updatedAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {card.sourcePost.authorUsername
                        ? `@${card.sourcePost.authorUsername}`
                        : card.sourcePost.authorName || "手動追加"}
                    </span>
                  </div>
                  {!selectMode && (
                    <Link
                      href={`/posts/${card.sourcePost.id}/learning`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button size="sm">
                        カードを見る
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && nextCursor && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-text-muted" />}
        </div>
      )}
    </div>
  );
}

function ExportButton({ ids, format }: { ids: string[]; format: "zip" | "bundle" }) {
  const confirm = useConfirm();
  const alert = useAlert();
  const [busy, setBusy] = useState(false);

  const exportNow = async () => {
    if (ids.length === 0) {
      const ok = await confirm("選択がないため、保存済みカード全件を書き出します。続行しますか？");
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "エクスポートに失敗しました");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download =
        format === "zip" ? `seedthought-${stamp}.zip` : `seedthought-${stamp}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      await alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={exportNow}
      loading={busy}
      loadingLabel="作成中..."
    >
      <Download className="mr-1.5 h-4 w-4" />
      {format === "zip" ? "ZIPで書き出す" : "1本のMDで書き出す"}
    </Button>
  );
}
