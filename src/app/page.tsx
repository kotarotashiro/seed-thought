"use client";

import { useEffect, useState } from "react";
import { PostCard } from "@/components/posts/PostCard";
import { RecommendationModeSelect } from "@/components/posts/RecommendationModeSelect";
import { Sprout } from "lucide-react";

export default function HomePage() {
  const [mode, setMode] = useState("undigested");
  const [genre, setGenre] = useState("");
  const [savedType, setSavedType] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadRecommendations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === "genre" && genre) params.set("genre", genre);
      if (savedType) params.set("savedType", savedType);

      const res = await fetch(`/api/recommendations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setGenres(data.genres || []);
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialRecommendations() {
      setLoadError(false);
      try {
        const params = new URLSearchParams({ mode });
        if (mode === "genre" && genre) params.set("genre", genre);
        if (savedType) params.set("savedType", savedType);

        const res = await fetch(`/api/recommendations?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setPosts(data.posts || []);
        setGenres(data.genres || []);
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitialRecommendations();
    return () => {
      cancelled = true;
    };
  }, [mode, genre, savedType]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
            <Sprout className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text sm:text-2xl">今日のおすすめ</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-text-secondary sm:ml-[52px]">
          {loading
            ? "おすすめを選んでいます…"
            : loadError
              ? "おすすめの取得に失敗しました。"
              : posts.length > 0
                ? `あなたの興味に合わせて${posts.length}件をピックアップしました。`
                : "おすすめできる投稿がまだありません。"}
        </p>
      </div>

      {/* Mode Select */}
      <RecommendationModeSelect
        mode={mode}
        genres={genres}
        selectedGenre={genre}
        selectedSavedType={savedType}
        onModeChange={setMode}
        onGenreChange={setGenre}
        onSavedTypeChange={setSavedType}
        onRefresh={() => loadRecommendations()}
        loading={loading}
      />

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-border p-6 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-border-light" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-border-light rounded w-24" />
                  <div className="h-2 bg-border-light rounded w-32" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-3 bg-border-light rounded" />
                <div className="h-3 bg-border-light rounded w-3/4" />
              </div>
              <div className="h-9 bg-border-light rounded-xl" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-danger-light flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-8 h-8 text-danger" />
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">
            おすすめを読み込めませんでした
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            通信エラーが発生した可能性があります。時間をおいて再試行してください。
          </p>
          <button
            onClick={() => loadRecommendations()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            再試行
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">
            まだ投稿がありません
          </h3>
          <p className="text-sm text-text-secondary">
            「投稿を追加」から手動で追加するか、X連携で投稿を取り込みましょう。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
            />
          ))}
        </div>
      )}
    </div>
  );
}
