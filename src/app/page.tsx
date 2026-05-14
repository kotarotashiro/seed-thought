"use client";

import { useEffect, useState } from "react";
import { PostCard } from "@/components/posts/PostCard";
import { RecommendationModeSelect } from "@/components/posts/RecommendationModeSelect";
import { Sprout } from "lucide-react";

export default function HomePage() {
  const [mode, setMode] = useState("latest");
  const [genre, setGenre] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecommendations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === "genre" && genre) params.set("genre", genre);

      const res = await fetch(`/api/recommendations?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setGenres(data.genres || []);
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialRecommendations() {
      try {
        const params = new URLSearchParams({ mode });
        if (mode === "genre" && genre) params.set("genre", genre);

        const res = await fetch(`/api/recommendations?${params}`);
        const data = await res.json();
        if (cancelled) return;
        setPosts(data.posts || []);
        setGenres(data.genres || []);
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitialRecommendations();
    return () => {
      cancelled = true;
    };
  }, [mode, genre]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
            <Sprout className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">今日の深掘り候補</h1>
          </div>
        </div>
        <p className="text-sm text-text-secondary mt-2 ml-[52px]">
          保存した投稿の中から、今日深掘りするのにおすすめの3件を選びました。
        </p>
      </div>

      {/* Mode Select */}
      <RecommendationModeSelect
        mode={mode}
        genres={genres}
        selectedGenre={genre}
        onModeChange={setMode}
        onGenreChange={setGenre}
        onRefresh={() => loadRecommendations()}
        loading={loading}
      />

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              showRecommendReason
            />
          ))}
        </div>
      )}
    </div>
  );
}
