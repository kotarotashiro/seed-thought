"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostFilters } from "@/components/posts/PostFilters";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import { PostChatModal } from "@/components/posts/PostChatModal";
import { PostTypeBadge, SavedTypeBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Archive,
  Trash2,
  Pencil,
  ArrowRight,
  Eye,
  ExternalLink,
  User,
  CheckCircle2,
  CheckSquare,
  Square,
  MessageCircle,
} from "lucide-react";

interface Author {
  username: string;
  name?: string | null;
}

interface PostListItem {
  id: string;
  text: string;
  translatedText?: string | null;
  mediaJson?: string | null;
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
  deepDiveSessions?: { id: string; status: string }[];
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export default function PostsPage() {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedPostType, setSelectedPostType] = useState("");
  const [selectedSavedType, setSelectedSavedType] = useState("");
  const [selectedDigestStatus, setSelectedDigestStatus] = useState("");
  const [selectedSort, setSelectedSort] = useState("savedAt_desc");
  const [selectedAuthor, setSelectedAuthor] = useState("");

  // Selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Edit modal state
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Chat modal state
  const [chatPost, setChatPost] = useState<PostListItem | null>(null);

  const loadPosts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedGenre) params.set("genre", selectedGenre);
      if (selectedPostType) params.set("postType", selectedPostType);
      if (selectedSavedType) params.set("savedType", selectedSavedType);
      if (selectedDigestStatus) params.set("digestStatus", selectedDigestStatus);
      if (selectedAuthor) params.set("author", selectedAuthor);
      params.set("sort", selectedSort);

      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setGenres(data.genres || []);
      setAuthors(data.authors || []);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialPosts() {
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set("search", searchQuery);
        if (selectedGenre) params.set("genre", selectedGenre);
        if (selectedPostType) params.set("postType", selectedPostType);
        if (selectedSavedType) params.set("savedType", selectedSavedType);
        if (selectedDigestStatus) params.set("digestStatus", selectedDigestStatus);
        if (selectedAuthor) params.set("author", selectedAuthor);
        params.set("sort", selectedSort);

        const res = await fetch(`/api/posts?${params}`);
        const data = await res.json();
        if (cancelled) return;
        setPosts(data.posts || []);
        setGenres(data.genres || []);
        setAuthors(data.authors || []);
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitialPosts();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, selectedGenre, selectedPostType, selectedSavedType, selectedDigestStatus, selectedSort, selectedAuthor]);

  const handleDelete = async (postId: string) => {
    if (!confirm("この投稿を削除しますか？")) return;
    try {
      await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      loadPosts();
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

  const selectAll = () => {
    setSelectedIds(new Set(posts.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択した${selectedIds.size}件の投稿を削除しますか？`)) return;
    setBulkDeleting(true);
    try {
      await fetch("/api/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      setSelectMode(false);
      loadPosts();
    } catch (error) {
      console.error("Failed to bulk delete:", error);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleEdit = async (postId: string) => {
    try {
      await fetch(`/api/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText }),
      });
      setEditingPost(null);
      loadPosts();
    } catch (error) {
      console.error("Failed to update:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
            <Archive className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">保存一覧</h1>
            <p className="text-sm text-text-secondary">
              {posts.length}件の投稿
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-shrink-0">
          {selectMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={selectedIds.size === posts.length ? deselectAll : selectAll}>
                {selectedIds.size === posts.length ? "全解除" : "全選択"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDelete}
                loading={bulkDeleting}
                loadingLabel="削除中..."
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                削除 ({selectedIds.size})
              </Button>
              <Button variant="secondary" size="sm" onClick={toggleSelectMode}>
                キャンセル
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className="w-full sm:w-auto" onClick={toggleSelectMode}>
                <CheckSquare className="w-4 h-4 mr-1.5" />
                選択
              </Button>
              <Link href="/posts/new" className="sm:flex-shrink-0">
                <Button className="w-full sm:w-auto">投稿を追加</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
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

      {/* Posts Table */}
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
          <Archive className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text mb-2">投稿がありません</h3>
          <p className="text-sm text-text-secondary mb-4">
            手動で追加するか、X連携で投稿を取り込みましょう。
          </p>
          <Link href="/posts/new">
            <Button>最初の投稿を追加</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">
          {posts.map((post) => (
            <Card
              key={post.id}
              hoverable
              className={`flex min-h-[280px] flex-col ${selectMode && selectedIds.has(post.id) ? "ring-2 ring-accent" : ""}`}
              onClick={selectMode ? () => toggleSelectPost(post.id) : undefined}
            >
              {selectMode && (
                <div className="flex items-center gap-2 mb-3 -mt-1">
                  {selectedIds.has(post.id) ? (
                    <CheckSquare className="w-5 h-5 text-accent" />
                  ) : (
                    <Square className="w-5 h-5 text-text-muted" />
                  )}
                  <span className="text-xs text-text-secondary">
                    {selectedIds.has(post.id) ? "選択中" : "クリックして選択"}
                  </span>
                </div>
              )}
              {editingPost === post.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="sm" onClick={() => handleEdit(post.id)} className="w-full sm:w-auto">保存</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingPost(null)} className="w-full sm:w-auto">キャンセル</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-start gap-3">
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-accent-light flex items-center justify-center">
                      {post.authorAvatarUrl ? (
                        <img
                          src={post.authorAvatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-accent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">
                        {post.authorName || "手動追加"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {post.authorUsername ? `@${post.authorUsername}` : "手動入力"}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-text leading-relaxed line-clamp-4 mb-4">
                    {post.text}
                  </p>
                  {post.translatedText && (
                    <p className="mb-4 rounded-xl bg-accent-subtle px-3 py-2 text-xs leading-relaxed text-text-secondary">
                      日本語訳: {post.translatedText}
                    </p>
                  )}
                  <PostMediaGrid media={parsePostMedia(post.mediaJson)} sourceUrl={post.sourceUrl} />

                  <div className="mt-auto space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {post.classification && (
                        <>
                          <PostTypeBadge type={post.classification.postType} />
                          <Badge>{post.classification.primaryCategory}</Badge>
                        </>
                      )}
                      <SavedTypeBadge type={post.savedType} />
                      {post.authorUsername && (
                        <span className="text-xs text-text-muted">
                          @{post.authorUsername}
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {post.postedAt
                          ? `投稿日 ${formatDate(post.postedAt)}`
                          : `保存日 ${formatDate(post.savedAt)}`}
                      </span>
                      {(post.deepDiveSessions?.length ?? 0) > 0 ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          深掘り済み
                        </Badge>
                      ) : (
                        <Badge variant="warning">未消化</Badge>
                      )}
                      {(post.threadPosts?.length ?? 0) > 0 && (
                        <Badge variant="success">
                          ツリー {(post.threadPosts?.length ?? 0) + 1}投稿
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Link href={`/posts/${post.id}/confirm`} className="min-w-0 flex-1">
                        <Button size="sm" className="w-full">
                          深掘る
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="この投稿についてチャット"
                        onClick={() => setChatPost(post)}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                      {post.sourceUrl && (
                        <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm" title="Xの投稿を開く">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                      <Link href={`/posts/${post.id}/confirm`}>
                        <Button variant="ghost" size="sm" title="詳細">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="編集"
                        onClick={() => {
                          setEditingPost(post.id);
                          setEditText(post.text);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="削除"
                        onClick={() => handleDelete(post.id)}
                      >
                        <Trash2 className="w-4 h-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Chat modal */}
      {chatPost && (
        <PostChatModal post={chatPost} onClose={() => setChatPost(null)} />
      )}
    </div>
  );
}
