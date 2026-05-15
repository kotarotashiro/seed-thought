"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PostTypeBadge, Badge } from "@/components/ui/Badge";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  BookOpen,
  GitBranch,
  Lightbulb,
  RefreshCw,
  User,
  Zap,
} from "lucide-react";

export default function ConfirmPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingThread, setFetchingThread] = useState(false);
  const [threadMessage, setThreadMessage] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  const loadPost = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}`);
      const data = await res.json();
      setPost(data);
    } catch (error) {
      console.error("Failed to fetch post:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialPost() {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        const data = await res.json();
        if (!cancelled) setPost(data);
      } catch (error) {
        console.error("Failed to fetch post:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitialPost();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleFetchThread = async () => {
    setFetchingThread(true);
    setThreadMessage(null);
    setThreadError(null);

    try {
      const res = await fetch(`/api/posts/${postId}/thread`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setThreadError(data.error || "ツリーの取得に失敗しました");
        return;
      }
      setThreadMessage(
        data.fetchedCount > 0
          ? `ツリーを${data.fetchedCount}件取得しました。`
          : "続きの投稿は見つかりませんでした。"
      );
      await loadPost();
    } catch {
      setThreadError("ツリーの取得に失敗しました");
    } finally {
      setFetchingThread(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-border-light rounded w-48" />
        <div className="h-40 bg-border-light rounded-2xl" />
        <div className="h-32 bg-border-light rounded-2xl" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary">投稿が見つかりません</p>
      </div>
    );
  }

  const gains = [
    { icon: BookOpen, label: "基礎理解", description: "この投稿のテーマの基本を理解できます" },
    { icon: Zap, label: "実践の型", description: "具体的な実践方法が見えてきます" },
    { icon: ArrowRight, label: "発信への転用", description: "自分の発信ネタとして活用できます" },
    { icon: Brain, label: "自分の考えの整理", description: "自分の視点や意見を言語化できます" },
  ];
  const threadPosts = post.threadPosts || [];
  const canFetchThread = post.source === "x" && post.sourcePostId;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-text mb-2">この投稿を深掘る？</h1>
        <p className="text-sm text-text-secondary">
          始める前に、投稿の内容と今回得られそうなものを確認します。
        </p>
      </div>

      {/* Original Post */}
      <Card>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center overflow-hidden">
            {post.authorAvatarUrl ? (
              <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-accent" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-text">{post.authorName || "手動追加"}</p>
            <p className="text-xs text-text-muted">
              {post.authorUsername ? `@${post.authorUsername}` : ""}
            </p>
          </div>
        </div>
        <p className="text-sm text-text leading-relaxed">{post.text}</p>
        {post.classification && (
          <div className="flex gap-2 mt-3">
            <PostTypeBadge type={post.classification.postType} />
            <Badge>{post.classification.primaryCategory}</Badge>
          </div>
        )}
        {canFetchThread && (
          <div className="mt-4 border-t border-border-light pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFetchThread}
                disabled={fetchingThread}
              >
                {fetchingThread ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <GitBranch className="w-4 h-4 mr-1" />
                )}
                {threadPosts.length > 0 ? "ツリーを再取得" : "ツリーを追加"}
              </Button>
              {threadPosts.length > 0 && (
                <Badge variant="success">ツリー {threadPosts.length + 1}投稿</Badge>
              )}
            </div>
            {threadMessage && (
              <p className="mt-2 text-xs text-success">{threadMessage}</p>
            )}
            {threadError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-light px-3 py-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
                <p className="text-xs text-danger">{threadError}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {threadPosts.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-accent" />
            <h3 className="text-base font-bold text-text">取得済みツリー</h3>
          </div>
          <div className="space-y-4">
            {threadPosts.map((threadPost: { id: string; text: string; threadOrder: number }) => (
              <div key={threadPost.id} className="rounded-xl bg-border-light px-4 py-3">
                <p className="mb-1 text-xs font-medium text-text-muted">
                  {threadPost.threadOrder + 1}投稿目
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                  {threadPost.text}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI Summary */}
      {post.classification && (
        <Card className="bg-accent-subtle border-accent/10">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-accent mb-1">AIのざっくり要約</p>
              <p className="text-sm text-text leading-relaxed">
                {post.classification.summary}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Gains */}
      <Card>
        <h3 className="text-base font-bold text-text mb-4">この投稿から得られそうなもの</h3>
        <div className="grid grid-cols-2 gap-3">
          {gains.map((gain) => {
            const Icon = gain.icon;
            return (
              <div key={gain.label} className="bg-border-light rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-text">{gain.label}</span>
                </div>
                <p className="text-xs text-text-secondary">{gain.description}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Link href="/" className="flex-1">
          <Button variant="secondary" className="w-full">
            別の候補を見る
          </Button>
        </Link>
        <Link href={`/posts/${postId}/mode`} className="flex-1">
          <Button className="w-full">
            深掘りを始める
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
