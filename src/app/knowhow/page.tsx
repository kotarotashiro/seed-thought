"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ArrowRight, ExternalLink, ChevronDown, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PostChatModal } from "@/components/posts/PostChatModal";

interface KnowhowPost {
  id: string;
  text: string;
  sourceUrl?: string | null;
  authorName?: string | null;
  authorUsername?: string | null;
  savedAt: string;
  classification?: {
    primaryCategory: string;
    summary: string;
    tagsJson: string;
    difficultyLevel: string;
    learningPotentialScore: number;
  } | null;
}

function DifficultyBadge({ level }: { level: string }) {
  switch (level) {
    case "beginner":
      return <Badge variant="success">初級</Badge>;
    case "intermediate":
      return <Badge variant="warning">中級</Badge>;
    case "advanced":
      return <Badge>上級</Badge>;
    default:
      return null;
  }
}

export default function KnowhowPage() {
  const [posts, setPosts] = useState<KnowhowPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [chatPost, setChatPost] = useState<KnowhowPost | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/posts?postType=learning&sort=savedAt_desc");
        const data = await res.json();
        if (!cancelled) setPosts(data.posts || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const categories = Array.from(
    new Set(posts.map((p) => p.classification?.primaryCategory).filter(Boolean))
  ) as string[];

  const filtered = selectedCategory
    ? posts.filter((p) => p.classification?.primaryCategory === selectedCategory)
    : posts;

  const grouped = filtered.reduce<Record<string, KnowhowPost[]>>((acc, post) => {
    const cat = post.classification?.primaryCategory ?? "未分類";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(post);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">ノウハウ一覧</h1>
          <p className="text-sm text-text-secondary">{posts.length}件の学習系投稿</p>
        </div>
      </div>

      {/* Category dropdown */}
      {categories.length > 0 && (
        <div className="relative inline-block w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-64 appearance-none bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-text pr-9 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
          >
            <option value="">すべてのカテゴリ ({posts.length}件)</option>
            {categories.map((cat) => {
              const count = posts.filter((p) => p.classification?.primaryCategory === cat).length;
              return (
                <option key={cat} value={cat}>
                  {cat} ({count}件)
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border px-4 py-3 animate-pulse flex gap-3">
              <div className="h-5 w-10 bg-border-light rounded" />
              <div className="flex-1 h-4 bg-border-light rounded" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <BookOpen className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text mb-2">ノウハウ投稿がありません</h3>
          <p className="text-sm text-text-secondary mb-4">
            X連携や手動追加で学習系投稿を取り込みましょう。
          </p>
          <Link href="/posts/new">
            <Button>投稿を追加</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryPosts]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className="text-sm font-bold text-text">{category}</h2>
                <span className="text-xs text-text-muted">{categoryPosts.length}件</span>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
                {categoryPosts.map((post) => {
                  const summary = post.classification?.summary || post.text;
                  return (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-border-light/40 transition-colors"
                    >
                      {post.classification && (
                        <div className="flex-shrink-0">
                          <DifficultyBadge level={post.classification.difficultyLevel} />
                        </div>
                      )}
                      <p className="min-w-0 flex-1 truncate text-sm text-text">{summary}</p>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <button
                          onClick={() => setChatPost(post)}
                          title="チャット"
                          className="rounded-lg p-1 text-text-muted hover:text-text hover:bg-border-light transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        {post.sourceUrl && (
                          <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 text-text-muted hover:text-text" />
                          </a>
                        )}
                        <Link href={`/posts/${post.id}/confirm`}>
                          <Button size="sm" variant="secondary">
                            深掘る
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {chatPost && (
        <PostChatModal
          post={{ id: chatPost.id, text: chatPost.text, authorName: chatPost.authorName, classification: chatPost.classification ?? null }}
          onClose={() => setChatPost(null)}
        />
      )}
    </div>
  );
}
