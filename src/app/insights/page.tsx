"use client";

import { useEffect, useState } from "react";
import { Heart, TrendingUp, Lightbulb, Star, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TrendInsight {
  topCategories: string[];
  favoriteThemes: string[];
  learningStyle: string;
  strengths: string[];
  recommendedNextTopics: string[];
  summary: string;
}

interface InsightData {
  insight: TrendInsight | null;
  count: number;
  cachedAt?: string;
  stats: {
    categoryCount: Record<string, number>;
    typeCount: Record<string, number>;
  };
}

function InsightSection({
  title,
  icon: Icon,
  items,
  color,
}: {
  title: string;
  icon: React.ElementType;
  items: string[];
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <h3 className="text-sm font-semibold text-text">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="text-sm bg-border-light text-text-secondary px-3 py-1.5 rounded-full">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const typeLabels: Record<string, string> = {
  thought: "思考系",
  learning: "学習系",
  output_material: "発信素材系",
  unknown: "未分類",
};

function formatCachedAt(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffH < 24) return `${diffH}時間前`;
  return `${diffD}日前`;
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState("");

  const load = async (force = false) => {
    if (force) setReanalyzing(true);
    else setLoading(true);
    setError("");
    try {
      const url = force ? "/api/insights/likes?force=true" : "/api/insights/likes";
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "取得に失敗しました");
      }
      const d = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setLoading(false);
      setReanalyzing(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">いいね傾向分析</h1>
            <p className="text-sm text-text-secondary">
              {data
                ? `${data.count}件のいいねを分析${data.cachedAt ? ` • 最終分析: ${formatCachedAt(data.cachedAt)}` : ""}`
                : "いいねした投稿から傾向を分析"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading || reanalyzing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${reanalyzing ? "animate-spin" : ""}`} />
          {reanalyzing ? "分析中..." : "再分析"}
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
              <div className="h-4 bg-border-light rounded w-1/4 mb-3" />
              <div className="flex gap-2">
                <div className="h-7 bg-border-light rounded-full w-20" />
                <div className="h-7 bg-border-light rounded-full w-24" />
                <div className="h-7 bg-border-light rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && data && data.count === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <Heart className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text mb-2">いいねした投稿がありません</h3>
          <p className="text-sm text-text-secondary">
            X連携でいいねした投稿を取り込むと傾向が分析されます。
          </p>
        </div>
      )}

      {!loading && data?.insight && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-200" />
              <span className="text-sm font-semibold text-rose-700">あなたの傾向まとめ</span>
            </div>
            <p className="text-sm text-text leading-relaxed">{data.insight.summary}</p>
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-semibold text-text">学習スタイル</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{data.insight.learningStyle}</p>
          </div>

          <InsightSection title="よく見るカテゴリ" icon={Star} items={data.insight.topCategories} color="text-blue-500" />
          <InsightSection title="好きなテーマ" icon={Heart} items={data.insight.favoriteThemes} color="text-rose-500" />
          <InsightSection title="あなたの強み" icon={TrendingUp} items={data.insight.strengths} color="text-green-500" />

          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-semibold text-text">次に学ぶとよいトピック</h3>
            </div>
            <ul className="space-y-2">
              {data.insight.recommendedNextTopics.map((topic) => (
                <li key={topic} className="flex items-center gap-2 text-sm text-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                  {topic}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-white rounded-2xl border border-border p-5">
              <h3 className="text-sm font-semibold text-text mb-3">カテゴリ分布</h3>
              <div className="space-y-2">
                {Object.entries(data.stats.categoryCount)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([cat, count]) => (
                    <div key={cat} className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-text truncate">{cat}</span>
                        <span className="text-xs text-text-muted ml-2">{count}</span>
                      </div>
                      <div className="h-1.5 bg-border-light rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${(count / data.count) * 100}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-5">
              <h3 className="text-sm font-semibold text-text mb-3">投稿タイプ分布</h3>
              <div className="space-y-2">
                {Object.entries(data.stats.typeCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-text">{typeLabels[type] ?? type}</span>
                        <span className="text-xs text-text-muted">{count}</span>
                      </div>
                      <div className="h-1.5 bg-border-light rounded-full overflow-hidden">
                        <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(count / data.count) * 100}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
