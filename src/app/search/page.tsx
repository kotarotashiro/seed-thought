"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, ExternalLink, Sparkles, Clock, X } from "lucide-react";
import { Badge, PostTypeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface SearchResultItem {
  postId: string;
  relevanceScore: number;
  reason: string;
  post: {
    id: string;
    text: string;
    sourceUrl?: string | null;
    authorName?: string | null;
    authorUsername?: string | null;
    classification?: {
      primaryCategory: string;
      postType: string;
      summary: string;
    } | null;
  };
}

const HISTORY_KEY = "knowhow-search-history";
const MAX_HISTORY = 8;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(query: string, current: string[]): string[] {
  const next = [query, ...current.filter((q) => q !== query)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>(loadHistory);

  const handleSearch = async (q?: string) => {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery) return;
    setQuery(searchQuery);
    setLoading(true);
    setError("");
    setSearched(false);

    try {
      const res = await fetch("/api/search/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "検索に失敗しました");
      }

      const data = await res.json();
      setResults(data.results || []);
      setSearched(true);
      setHistory(saveHistory(searchQuery, history));
    } catch (e) {
      setError(e instanceof Error ? e.message : "検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const removeHistory = (q: string) => {
    const next = history.filter((h) => h !== q);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
          <Search className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">メモを検索</h1>
          <p className="text-sm text-text-secondary">悩みや目標を入力して関連メモを探す</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>AIがあなたの悩みに合った投稿を見つけます</span>
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch();
          }}
          placeholder={"例: SNSのフォロワーを増やすには？\n例: 文章を読みやすくするコツが知りたい"}
          className="w-full rounded-xl border border-border px-4 py-3 text-sm resize-none min-h-[100px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Cmd+Enter で検索</span>
          <Button onClick={() => handleSearch()} loading={loading} loadingLabel="検索中...">
            <Search className="w-4 h-4 mr-1.5" />
            検索する
          </Button>
        </div>
      </div>

      {/* Search history */}
      {history.length > 0 && !searched && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-muted flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            検索履歴
          </p>
          <div className="flex flex-wrap gap-2">
            {history.map((q) => (
              <div key={q} className="flex items-center gap-1 bg-white border border-border rounded-full px-3 py-1 group">
                <button
                  onClick={() => handleSearch(q)}
                  className="text-xs text-text-secondary hover:text-text max-w-[200px] truncate"
                >
                  {q}
                </button>
                <button
                  onClick={() => removeHistory(q)}
                  className="text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {searched && results.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-border">
          <Search className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">該当するメモが見つかりませんでした</p>
          <p className="text-xs text-text-muted mt-1">別のキーワードやフレーズで試してみてください</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">{results.length}件の関連メモが見つかりました</p>
          {results.map((item) => (
            <Card key={item.postId} hoverable className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {item.post.classification && (
                    <>
                      <PostTypeBadge type={item.post.classification.postType} />
                      <Badge>{item.post.classification.primaryCategory}</Badge>
                    </>
                  )}
                  <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    関連度 {item.relevanceScore}%
                  </span>
                </div>
                {item.post.sourceUrl && (
                  <a href={item.post.sourceUrl} target="_blank" rel="noreferrer" className="flex-shrink-0">
                    <ExternalLink className="w-4 h-4 text-text-muted hover:text-text" />
                  </a>
                )}
              </div>

              <p className="text-sm text-text leading-relaxed line-clamp-3">
                {item.post.classification?.summary || item.post.text}
              </p>

              <div className="bg-purple-50 rounded-lg px-3 py-2 text-xs text-purple-700">
                <span className="font-medium">関連理由: </span>{item.reason}
              </div>

              {item.post.authorUsername && (
                <p className="text-xs text-text-muted">@{item.post.authorUsername}</p>
              )}

              <div className="mt-auto">
                <Link href={`/posts/${item.postId}/confirm`}>
                  <Button size="sm" className="w-full">
                    深掘る
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
