"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostFilters } from "@/components/posts/PostFilters";
import { PostTypeBadge, SavedTypeBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Archive, Trash2, Pencil, ArrowRight, Eye, ExternalLink } from "lucide-react";

interface PostListItem {
  id: string;
  text: string;
  sourceUrl?: string | null;
  savedType: string;
  authorUsername?: string | null;
  postedAt?: string | null;
  savedAt: string;
  classification?: {
    postType: string;
    primaryCategory: string;
  } | null;
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
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedPostType, setSelectedPostType] = useState("");
  const [selectedSavedType, setSelectedSavedType] = useState("");
  const [selectedDigestStatus, setSelectedDigestStatus] = useState("");
  const [selectedSort, setSelectedSort] = useState("postedAt_desc");

  // Edit modal state
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const loadPosts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedGenre) params.set("genre", selectedGenre);
      if (selectedPostType) params.set("postType", selectedPostType);
      if (selectedSavedType) params.set("savedType", selectedSavedType);
      if (selectedDigestStatus) params.set("digestStatus", selectedDigestStatus);
      params.set("sort", selectedSort);

      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setGenres(data.genres || []);
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
        params.set("sort", selectedSort);

        const res = await fetch(`/api/posts?${params}`);
        const data = await res.json();
        if (cancelled) return;
        setPosts(data.posts || []);
        setGenres(data.genres || []);
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
  }, [searchQuery, selectedGenre, selectedPostType, selectedSavedType, selectedDigestStatus, selectedSort]);

  const handleDelete = async (postId: string) => {
    if (!confirm("この投稿を削除しますか？")) return;
    try {
      await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      loadPosts();
    } catch (error) {
      console.error("Failed to delete:", error);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        <Link href="/posts/new">
          <Button>投稿を追加</Button>
        </Link>
      </div>

      {/* Filters */}
      <PostFilters
        genres={genres}
        selectedGenre={selectedGenre}
        selectedPostType={selectedPostType}
        selectedSavedType={selectedSavedType}
        selectedDigestStatus={selectedDigestStatus}
        selectedSort={selectedSort}
        searchQuery={searchQuery}
        onGenreChange={setSelectedGenre}
        onPostTypeChange={setSelectedPostType}
        onSavedTypeChange={setSelectedSavedType}
        onDigestStatusChange={setSelectedDigestStatus}
        onSortChange={setSelectedSort}
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
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="divide-y divide-border-light">
            {posts.map((post) => (
              <div key={post.id} className="p-4 hover:bg-border-light/50 transition-colors">
                {editingPost === post.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full rounded-xl border border-border px-4 py-3 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEdit(post.id)}>保存</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPost(null)}>キャンセル</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text leading-relaxed line-clamp-2 mb-2">
                        {post.text}
                      </p>
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
                          <Badge variant="success">深掘り済み</Badge>
                        ) : (
                          <Badge variant="warning">未消化</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
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
                      <Link href={`/posts/${post.id}/confirm`}>
                        <Button variant="ghost" size="sm" title="深掘りする">
                          <ArrowRight className="w-4 h-4" />
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
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
