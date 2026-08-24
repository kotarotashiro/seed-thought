"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PostCard } from "@/components/posts/PostCard";
import { RecommendationModeSelect } from "@/components/posts/RecommendationModeSelect";
import { TodaySynthesisCard } from "@/components/synthesis/TodaySynthesisCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BookOpen, Sprout, User, GraduationCap, ChevronRight } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

type AutoLearnedCard = {
  postId: string;
  learnedAt: string;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  id: string;
  title: string;
  summary: string;
};

// ─── Hero sub-components ──────────────────────────────────────

function TodayHeroSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-6 sm:p-8 animate-pulse">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-full bg-border-light flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-border-light rounded w-32" />
          <div className="h-3 bg-border-light rounded w-24" />
        </div>
      </div>
      <div className="space-y-2 mb-6">
        <div className="h-4 bg-border-light rounded" />
        <div className="h-4 bg-border-light rounded w-5/6" />
        <div className="h-4 bg-border-light rounded w-4/6" />
        <div className="h-4 bg-border-light rounded w-3/6" />
      </div>
      <div className="h-12 bg-border-light rounded-xl" />
    </div>
  );
}

function RecentAutoLearnedSection({
  cards,
  loading,
  error,
}: {
  cards: AutoLearnedCard[];
  loading: boolean;
  error: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="recent-auto-learned-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent">理解が積み上がる</p>
          <h2 id="recent-auto-learned-heading" className="mt-1 text-xl font-bold tracking-tight text-text">
            過去に自動学習した素材
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {loading
              ? "過去の自動学習カードを確認しています…"
              : error
                ? "過去の自動学習カードを読み込めませんでした。"
                : "この1週間に自動学習されたカードは" + cards.length + "件です"}
          </p>
        </div>
        <Link href="/knowhow" className="text-sm font-medium text-accent hover:underline">
          学びメモをすべて見る
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-xl border border-border bg-bg-card p-5">
              <div className="mb-4 h-3 w-24 rounded bg-border-light" />
              <div className="mb-2 h-5 w-4/5 rounded bg-border-light" />
              <div className="h-3 w-full rounded bg-border-light" />
              <div className="mt-2 h-3 w-3/4 rounded bg-border-light" />
            </div>
          ))}
        </div>
      ) : error ? (
        <Card className="py-8 text-center">
          <p className="text-sm text-text-secondary">時間をおいてページを再読み込みしてください。</p>
        </Card>
      ) : cards.length === 0 ? (
        <Card className="border-border-light bg-bg-card py-8 text-center">
          <GraduationCap className="mx-auto mb-3 h-7 w-7 text-accent" />
          <p className="font-medium text-text">過去1週間の自動学習カードはありません</p>
          <p className="mt-1 text-sm text-text-secondary">
            AutoLearn は停止中です。必要な投稿は保存一覧から手動でカード化できます。
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.id} href={"/posts/" + card.postId + "/learning"} className="group block">
              <Card hoverable className="h-full p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-light">
                    {card.authorAvatarUrl ? (
                      <img src={card.authorAvatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-accent" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-text-secondary">
                      {card.authorName || "自動学習"}
                    </p>
                    {card.authorUsername && (
                      <p className="truncate text-xs text-text-muted">@{card.authorUsername}</p>
                    )}
                  </div>
                </div>
                <h3 className="line-clamp-2 text-base font-semibold leading-snug text-text group-hover:text-accent">
                  {card.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary">{card.summary}</p>
                <p className="mt-4 text-xs font-medium text-accent">学習カードを見る →</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function TodayHero({
  post,
  loading,
  error,
}: {
  post: Post;
  loading: boolean;
  error: boolean;
}) {
  if (loading) return <TodayHeroSkeleton />;

  if (error) {
    return (
      <Card className="text-center py-10">
        <div className="w-14 h-14 rounded-xl bg-danger-light flex items-center justify-center mx-auto mb-4">
          <Sprout className="w-7 h-7 text-danger" />
        </div>
        <h3 className="font-semibold text-text mb-2">読み込みに失敗しました</h3>
        <p className="text-sm text-text-secondary">
          時間をおいてページを再読み込みしてください。
        </p>
      </Card>
    );
  }

  if (!post) {
    return (
      <Card className="text-center py-10">
        <div className="w-14 h-14 rounded-xl bg-accent-light flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-7 h-7 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-text mb-2">未学習はありません</h3>
        <p className="text-sm text-text-secondary mb-6">
          すべての投稿を学習済みです。学びメモを見返しましょう。
        </p>
        <Link href="/knowhow">
          <Button variant="primary" size="lg">
            学びメモを見る
            <ChevronRight className="w-4 h-4 ml-1.5" />
          </Button>
        </Link>
      </Card>
    );
  }

  const displayText = post.classification?.summary || post.text;
  const category = post.classification?.primaryCategory;

  return (
    <Link href={`/posts/${post.id}/confirm`} className="block group">
      <Card hoverable className="sm:p-8">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center flex-shrink-0 overflow-hidden">
            {post.authorAvatarUrl ? (
              <img
                src={post.authorAvatarUrl}
                alt={post.authorName || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-accent" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text truncate">{post.authorName || "手動追加"}</p>
            {post.authorUsername && (
              <p className="text-sm text-text-muted">@{post.authorUsername}</p>
            )}
          </div>
          {category && <Badge className="flex-shrink-0">{category}</Badge>}
        </div>

        <p className="text-base sm:text-lg text-text leading-relaxed line-clamp-4 mb-6">
          {displayText}
        </p>

        <Button
          variant="primary"
          size="lg"
          className="w-full pointer-events-none"
        >
          <BookOpen className="w-5 h-5 mr-2" />
          学ぶ
        </Button>
      </Card>
    </Link>
  );
}

function StatBar({
  undigestedTotal,
  knowhowTotal,
}: {
  undigestedTotal: number | null;
  knowhowTotal: number | null;
}) {
  return (
    <div className="flex gap-3">
      <Link
        href="/posts"
        className="flex-1 flex items-center justify-between rounded-xl border border-border bg-bg-card px-4 py-3 hover:border-text-muted/40 hover:bg-border-light transition-colors"
      >
        <span className="text-sm text-text-secondary">未学習</span>
        <span className="text-base font-bold text-text">
          {undigestedTotal === null ? "…" : `${undigestedTotal}件`}
        </span>
      </Link>
      <Link
        href="/knowhow"
        className="flex-1 flex items-center justify-between rounded-xl border border-border bg-bg-card px-4 py-3 hover:border-text-muted/40 hover:bg-border-light transition-colors"
      >
        <span className="text-sm text-text-secondary">学びメモ</span>
        <span className="text-base font-bold text-text">
          {knowhowTotal === null ? "…" : `${knowhowTotal}件`}
        </span>
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function HomePage() {
  const [heroPost, setHeroPost] = useState<Post>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroError, setHeroError] = useState(false);

  const [recentCards, setRecentCards] = useState<AutoLearnedCard[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState(false);

  const [undigestedTotal, setUndigestedTotal] = useState<number | null>(null);
  const [knowhowTotal, setKnowhowTotal] = useState<number | null>(null);

  const [mode, setMode] = useState("undigested");
  const [genre, setGenre] = useState("");
  const [savedType, setSavedType] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [gridPosts, setGridPosts] = useState<Post[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState(false);

  // prevents the mode-change effect from firing before initial mount fetch
  const gridInitRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecentAutoLearned() {
      try {
        const res = await fetch("/api/auto-learn/recent");
        if (!res.ok) throw new Error("recent auto-learned cards failed");
        const data = (await res.json()) as { cards?: AutoLearnedCard[] };
        if (!cancelled) setRecentCards(data.cards ?? []);
      } catch {
        if (!cancelled) setRecentError(true);
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    }

    fetchRecentAutoLearned();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initial fetch: hero post + undigested count + knowhow count
  useEffect(() => {
    let cancelled = false;

    async function fetchInitial() {
      try {
        const [recRes, kcRes] = await Promise.all([
          fetch("/api/recommendations?mode=undigested"),
          fetch("/api/learning-cards?limit=1"),
        ]);
        if (cancelled) return;

        if (!recRes.ok) throw new Error("recommendations failed");

        const recData = await recRes.json();
        if (cancelled) return;

        const posts: Post[] = recData.posts ?? [];
        setHeroPost(posts[0] ?? null);
        setGridPosts(posts.slice(1));
        setGenres(recData.genres ?? []);
        if (typeof recData.undigestedTotal === "number") {
          setUndigestedTotal(recData.undigestedTotal);
        }

        if (kcRes.ok) {
          const kcData = await kcRes.json();
          if (!cancelled && typeof kcData.total === "number") {
            setKnowhowTotal(kcData.total);
          }
        }

        gridInitRef.current = true;
      } catch {
        if (!cancelled) setHeroError(true);
      } finally {
        if (!cancelled) setHeroLoading(false);
      }
    }

    fetchInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGrid = async (showLoading = true) => {
    if (showLoading) setGridLoading(true);
    setGridError(false);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === "genre" && genre) params.set("genre", genre);
      if (savedType) params.set("savedType", savedType);
      const res = await fetch(`/api/recommendations?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGridPosts(data.posts ?? []);
      setGenres(data.genres ?? []);
    } catch {
      setGridError(true);
    } finally {
      setGridLoading(false);
    }
  };

  // Re-fetch grid when mode/genre/savedType changes (skip initial run)
  useEffect(() => {
    if (!gridInitRef.current) return;

    let cancelled = false;

    async function fetchGrid() {
      setGridError(false);
      try {
        const params = new URLSearchParams({ mode });
        if (mode === "genre" && genre) params.set("genre", genre);
        if (savedType) params.set("savedType", savedType);
        const res = await fetch(`/api/recommendations?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          setGridPosts(data.posts ?? []);
          setGenres(data.genres ?? []);
        }
      } catch {
        if (!cancelled) setGridError(true);
      } finally {
        if (!cancelled) setGridLoading(false);
      }
    }

    setGridLoading(true);
    fetchGrid();
    return () => {
      cancelled = true;
    };
  }, [mode, genre, savedType]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">
          理解と資産化
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          保存した投稿から必要なものを選び、手動で学習カードにしましょう
        </p>
      </div>

      <RecentAutoLearnedSection
        cards={recentCards}
        loading={recentLoading}
        error={recentError}
      />

      {/* Hero */}
      <TodayHero post={heroPost} loading={heroLoading} error={heroError} />

      {/* Stat Bar */}
      <StatBar undigestedTotal={undigestedTotal} knowhowTotal={knowhowTotal} />

      {/* Secondary Grid */}
      <div className="space-y-5">
        <h2 className="text-base font-semibold text-text-secondary">他の候補から選ぶ</h2>

        <RecommendationModeSelect
          mode={mode}
          genres={genres}
          selectedGenre={genre}
          selectedSavedType={savedType}
          onModeChange={setMode}
          onGenreChange={setGenre}
          onSavedTypeChange={setSavedType}
          onRefresh={() => loadGrid()}
          loading={gridLoading}
        />

        {heroLoading || gridLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-bg-card rounded-xl border border-border p-4 sm:p-5 animate-pulse"
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
        ) : gridError ? (
          <div className="text-center py-12">
            <p className="text-sm text-text-secondary mb-4">候補の取得に失敗しました。</p>
            <Button variant="primary" onClick={() => loadGrid()}>
              再試行
            </Button>
          </div>
        ) : gridPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-text-secondary">このモードでは他の候補がありません。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            {gridPosts.map((post: Post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      <TodaySynthesisCard />
    </div>
  );
}
