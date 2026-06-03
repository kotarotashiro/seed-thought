"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PostFilters } from "@/components/posts/PostFilters";
import { PostCard } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useConfirm, useAlert } from "@/components/ui/DialogProvider";
import { Archive, Trash2, CheckSquare, Square, Sparkles, BookOpen } from "lucide-react";

interface Author {
  username: string;
  name?: string | null;
}

interface PostListItem {
  id: string;
  text: string;
  translatedText?: string | null;
  mediaJson?: string | null;
  urlCardJson?: string | null;
  sourceUrl?: string | null;
  savedType: string;
  authorName?: string | null;
  authorUsername?: string | null;
  authorAvatarUrl?: string | null;
  postedAt?: string | null;
  savedAt: string;
  classification?: {
    postType: string;
    primaryCategory: string;
  } | null;
  threadPosts?: { id: string }[];
  learningCard?: { id: string; status: string } | null;
}

const PAGE_LIMIT = 20;

function buildParams(opts: {
  searchQuery: string;
  selectedGenre: string;
  selectedPostType: string;
  selectedSavedType: string;
  selectedDigestStatus: string;
  selectedAuthor: string;
  activeTab: "saved" | "recommend";
  selectedSort: string;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (opts.searchQuery) params.set("search", opts.searchQuery);
  if (opts.selectedGenre) params.set("genre", opts.selectedGenre);
  if (opts.selectedPostType) params.set("postType", opts.selectedPostType);
  if (opts.selectedSavedType) params.set("savedType", opts.selectedSavedType);
  if (opts.selectedDigestStatus) params.set("digestStatus", opts.selectedDigestStatus);
  if (opts.selectedAuthor) params.set("author", opts.selectedAuthor);
  if (opts.activeTab === "recommend") params.set("source", "agent_recommend");
  params.set("sort", opts.selectedSort);
  params.set("limit", String(PAGE_LIMIT));
  if (opts.cursor) params.set("cursor", opts.cursor);
  return params;
}

export default function PostsPage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const router = useRouter();
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedPostType, setSelectedPostType] = useState("");
  const [selectedSavedType, setSelectedSavedType] = useState("");
  const [selectedDigestStatus, setSelectedDigestStatus] = useState("");
  const [selectedSort, setSelectedSort] = useState("likedAt_desc");
  const [selectedAuthor, setSelectedAuthor] = useState("");

  const [activeTab, setActiveTab] = useState<"saved" | "recommend">("saved");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const filterDeps = {
    searchQuery,
    selectedGenre,
    selectedPostType,
    selectedSavedType,
    selectedDigestStatus,
    selectedAuthor,
    activeTab,
    selectedSort,
  } as const;

  // Fetch first page whenever filters change
  useEffect(() => {
    let cancelled = false;

    async function fetchFirstPage() {
      // Reset state inside the async function to avoid synchronous setState in effect body
      if (!cancelled) {
        setPosts([]);
        setNextCursor(null);
        setLoading(true);
      }
      try {
        const params = buildParams(filterDeps);
        const res = await fetch(`/api/posts?${params}`);
        const data = await res.json();
        if (cancelled) return;
        setPosts(data.posts || []);
        setNextCursor(data.nextCursor ?? null);
        if (data.genres?.length) setGenres(data.genres);
        if (data.authors?.length) setAuthors(data.authors);
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFirstPage();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedGenre, selectedPostType, selectedSavedType, selectedDigestStatus, selectedSort, selectedAuthor, activeTab]);

  // Load next page
  const loadMore = useCallback(async (cursor: string) => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const params = buildParams({ ...filterDeps, cursor });
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts((prev) => [...prev, ...(data.posts || [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (error) {
      console.error("Failed to load more posts:", error);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, searchQuery, selectedGenre, selectedPostType, selectedSavedType, selectedDigestStatus, selectedSort, selectedAuthor, activeTab]);

  // IntersectionObserver to trigger loadMore when sentinel is visible
  useEffect(() => {
    if (!nextCursor || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor) {
          loadMore(nextCursor);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  // Reload from first page (used after delete)
  const reloadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams(filterDeps);
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setNextCursor(data.nextCursor ?? null);
      if (data.genres?.length) setGenres(data.genres);
      if (data.authors?.length) setAuthors(data.authors);
    } catch (error) {
      console.error("Failed to reload posts:", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedGenre, selectedPostType, selectedSavedType, selectedDigestStatus, selectedSort, selectedAuthor, activeTab]);

  const handleDelete = async (postId: string) => {
    const ok = await confirm({
      message: "この投稿を削除しますか？",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      reloadPosts();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  };

  const toggleSelectPost = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(posts.map((p) => p.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      message: `選択した${selectedIds.size}件の投稿を削除しますか？`,
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await fetch("/api/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      setSelectMode(false);
      reloadPosts();
    } catch (error) {
      console.error("Failed to bulk delete:", error);
    } finally {
      setBulkDeleting(false);
    }
  };

  // 選択した投稿の学習カードを一括生成する。
  // 1回の生成がLLM呼び出し（数分かかる場合あり）でVercelの300秒上限に近いため、
  // サーバ側でループせずクライアント側で1件ずつ逐次に投げる（既存の単体生成APIを再利用）。
  const handleBulkGenerate = async () => {
    const targets = posts.filter((p) => selectedIds.has(p.id) && !p.learningCard);
    const alreadyCount = selectedIds.size - targets.length;
    if (targets.length === 0) {
      await alert("選択した投稿はすべて学習カードを作成済みです。");
      return;
    }
    const ok = await confirm({
      message:
        `${targets.length}件の学習カードを生成します` +
        (alreadyCount > 0 ? `（作成済み${alreadyCount}件はスキップ）` : "") +
        "。\n1件ずつ生成するため数分かかることがあります。完了するまでこのタブを開いたままにしてください。",
      confirmLabel: "生成する",
    });
    if (!ok) return;

    setGenProgress({ done: 0, total: targets.length });
    let success = 0;
    let failed = 0;
    let aborted = false;

    for (let i = 0; i < targets.length; i++) {
      try {
        const res = await fetch(`/api/posts/${targets[i].id}/learning`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ learningMode: "content" }),
        });
        if (res.ok) {
          success++;
        } else {
          const data = await res.json().catch(() => ({}));
          if (res.status === 503 && (data as { code?: string }).code === "GROK_TOKEN_EXPIRED") {
            aborted = true;
            break;
          }
          failed++;
        }
      } catch {
        failed++;
      }
      setGenProgress({ done: i + 1, total: targets.length });
    }

    setGenProgress(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    await reloadPosts();

    if (aborted) {
      await alert("Grokの認証が切れています。設定から再接続してから、もう一度お試しください。");
      return;
    }
    const go = await confirm({
      message:
        `学習カードを${success}件生成しました` +
        (failed > 0 ? `（失敗${failed}件）` : "") +
        "。学びメモを見ますか？",
      confirmLabel: "学びメモを見る",
      cancelLabel: "閉じる",
    });
    if (go) router.push("/knowhow");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
            <Archive className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">保存した投稿</h1>
            <p className="text-sm text-text-secondary">{posts.length}件を表示中</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:flex-shrink-0">
          <Button
            variant={selectMode ? "primary" : "secondary"}
            onClick={toggleSelectMode}
            disabled={genProgress !== null}
          >
            <CheckSquare className="w-4 h-4 mr-1.5" />
            {selectMode ? "選択を終了" : "選択"}
          </Button>
          <Link href="/posts/new" className="sm:flex-shrink-0">
            <Button>投稿を追加</Button>
          </Link>
        </div>
      </div>

      {/* Source tabs */}
      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: "saved", label: "保存済み", icon: <Archive className="h-3.5 w-3.5" /> },
          { value: "recommend", label: "おすすめ", icon: <Sparkles className="h-3.5 w-3.5" /> },
        ]}
      />

      <PostFilters
        genres={genres}
        authors={authors}
        selectedGenre={selectedGenre}
        selectedPostType={selectedPostType}
        selectedSavedType={selectedSavedType}
        selectedDigestStatus={selectedDigestStatus}
        selectedSort={selectedSort}
        selectedAuthor={selectedAuthor}
        searchQuery={searchQuery}
        onGenreChange={setSelectedGenre}
        onPostTypeChange={setSelectedPostType}
        onSavedTypeChange={setSelectedSavedType}
        onDigestStatusChange={setSelectedDigestStatus}
        onSortChange={setSelectedSort}
        onAuthorChange={setSelectedAuthor}
        onSearchChange={setSearchQuery}
      />

      {selectMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={genProgress !== null}
            onClick={selectedIds.size === posts.length && posts.length > 0 ? deselectAll : selectAll}
          >
            {posts.length > 0 && selectedIds.size === posts.length ? (
              <CheckSquare className="h-4 w-4 mr-1.5 text-accent" />
            ) : (
              <Square className="h-4 w-4 mr-1.5 text-text-muted" />
            )}
            全選択
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkGenerate}
              loading={genProgress !== null}
              loadingLabel={genProgress ? `生成中... ${genProgress.done}/${genProgress.total}件` : "生成中..."}
              disabled={selectedIds.size === 0}
            >
              <BookOpen className="h-4 w-4 mr-1.5" />
              学習カードを生成 ({selectedIds.size})
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              loading={bulkDeleting}
              loadingLabel="削除中..."
              disabled={selectedIds.size === 0 || genProgress !== null}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              削除 ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-4 animate-pulse">
              <div className="h-4 bg-border-light rounded w-3/4 mb-2" />
              <div className="h-3 bg-border-light rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          {activeTab === "recommend" ? (
            <>
              <Sparkles className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text mb-2">おすすめはまだありません</h3>
              <p className="text-sm text-text-secondary mb-4">
                投稿が増えると、AIがあなたの興味に合った投稿を自動でおすすめします。
              </p>
            </>
          ) : (
            <>
              <Archive className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text mb-2">投稿がありません</h3>
              <p className="text-sm text-text-secondary mb-4">
                手動で追加するか、X連携で投稿を取り込みましょう。
              </p>
              <Link href="/posts/new">
                <Button>最初の投稿を追加</Button>
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                showLearningButton
                onDelete={handleDelete}
                selectMode={selectMode}
                selected={selectedIds.has(post.id)}
                onToggleSelect={toggleSelectPost}
              />
            ))}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <p className="text-sm text-text-secondary animate-pulse">次を読み込み中...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
