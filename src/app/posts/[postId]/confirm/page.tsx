"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PostTypeBadge, Badge, LearningStatusBadge } from "@/components/ui/Badge";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  BookOpen,
  GitBranch,
  Lightbulb,
  User,
  Zap,
} from "lucide-react";

function buildGains(post: {
  classification?: {
    postType: string;
    primaryCategory: string;
    summary: string;
    recommendReason: string;
  } | null;
  learningCard?: { id: string; status: string } | null;
}) {
  const category = post.classification?.primaryCategory || "このテーマ";
  const summary = post.classification?.summary || "投稿の中心テーマ";
  const reason = post.classification?.recommendReason || "自分の仕事や発信に置き換える視点";

  if (post.classification?.postType === "learning") {
    return [
      { icon: BookOpen, label: "学ぶテーマ", description: summary },
      { icon: Lightbulb, label: "背景知識", description: `${category}の前提や用語を整理できます` },
      { icon: Zap, label: "実務の型", description: reason },
      { icon: ArrowRight, label: "次の一手", description: "自分の作業で試す手順に落とし込めます" },
    ];
  }

  return [
    { icon: Brain, label: "主張の核", description: summary },
    { icon: Lightbulb, label: "前提の整理", description: `${category}で成り立つ条件を考えられます` },
    { icon: Zap, label: "反論と条件", description: "どこまで使える考え方か見極められます" },
    { icon: ArrowRight, label: "発信への転用", description: reason },
  ];
}

export default function ConfirmPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingThread, setFetchingThread] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [creatingDeepDive, setCreatingDeepDive] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
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
      setSelectedThreadIds([]);
    } catch {
      setThreadError("ツリーの取得に失敗しました");
    } finally {
      setFetchingThread(false);
    }
  };

  const handleToggleThread = (id: string) => {
    setSelectedThreadIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleDeleteSelectedThreads = async () => {
    if (selectedThreadIds.length === 0) return;
    if (!confirm(`選択したツリー投稿 ${selectedThreadIds.length}件を削除しますか？`)) return;

    setDeletingThread(true);
    setThreadMessage(null);
    setThreadError(null);

    try {
      const res = await fetch(`/api/posts/${postId}/thread`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedThreadIds }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setThreadError(data.error || "ツリー投稿の削除に失敗しました");
        return;
      }
      setThreadMessage(`ツリー投稿を${data.deletedCount}件削除しました。`);
      setSelectedThreadIds([]);
      await loadPost();
    } catch {
      setThreadError("ツリー投稿の削除に失敗しました");
    } finally {
      setDeletingThread(false);
    }
  };

  const handleStartDeepDive = async () => {
    setCreatingDeepDive(true);

    try {
      const res = await fetch("/api/deep-dive/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, mode: "thought_lens" }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "深掘りセッションの作成に失敗しました");
      }

      router.push(`/deep-dive/${data.id}/thought`);
    } catch (error) {
      console.error("Failed to create thought session:", error);
      alert(error instanceof Error ? error.message : "深掘りセッションの作成に失敗しました");
      setCreatingDeepDive(false);
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

  const gains = buildGains(post);
  const threadPosts = post.threadPosts || [];
  const canFetchThread = post.source === "x" && post.sourcePostId;
  const postMedia = parsePostMedia(post.mediaJson);

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
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
        <h1 className="mb-2 text-xl font-bold text-text sm:text-2xl">この投稿を深掘る？</h1>
        <p className="text-sm text-text-secondary">
          始める前に、投稿の内容と今回得られそうなものを確認します。
        </p>
      </div>

      {/* Original Post */}
      <Card>
        <div className="mb-3 flex items-center gap-3">
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
        {(() => {
          const isUrlOnly = /^https?:\/\/\S+$/.test((post.text || "").trim());
          const urlCard = post.urlCardJson
            ? (() => {
                try {
                  return JSON.parse(post.urlCardJson);
                } catch {
                  return null;
                }
              })()
            : null;
          if (isUrlOnly && urlCard) {
            return (
              <>
                <p className="mb-3 truncate text-xs text-text-muted">{post.text.trim()}</p>
                <a
                  href={urlCard.expandedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border border-border transition-colors hover:border-accent/40"
                >
                  {urlCard.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urlCard.imageUrl}
                      alt=""
                      className="h-40 w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <div className="px-4 py-3">
                    {urlCard.title && (
                      <p className="mb-1 line-clamp-2 text-sm font-medium text-text">{urlCard.title}</p>
                    )}
                    {urlCard.description && (
                      <p className="line-clamp-3 text-xs text-text-secondary">{urlCard.description}</p>
                    )}
                    <p className="mt-1 truncate text-xs text-text-muted">{urlCard.expandedUrl}</p>
                  </div>
                </a>
              </>
            );
          }
          return (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{post.text}</p>
          );
        })()}
        {post.translatedText && (
          <div className="mt-3 rounded-xl border border-accent/10 bg-accent-subtle px-4 py-3">
            <p className="mb-1 text-xs font-medium text-accent">日本語訳</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              {post.translatedText}
            </p>
          </div>
        )}
        <PostMediaGrid media={postMedia} />
        {post.classification && (
          <div className="flex gap-2 mt-3">
            <PostTypeBadge type={post.classification.postType} />
            <Badge>{post.classification.primaryCategory}</Badge>
            <LearningStatusBadge learningCard={post.learningCard} />
          </div>
        )}
        {canFetchThread && (
          <div className="mt-4 border-t border-border-light pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFetchThread}
                disabled={fetchingThread || deletingThread}
                loading={fetchingThread}
                loadingLabel="取得中..."
              >
                <GitBranch className="w-4 h-4 mr-1" />
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
            <Badge variant="success">{threadPosts.length + 1}投稿</Badge>
          </div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-text-muted">
              選択した続き投稿だけ削除できます。深掘り作成時は、残っているツリー全体を含めます。
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteSelectedThreads}
              disabled={selectedThreadIds.length === 0}
              loading={deletingThread}
              loadingLabel="削除中..."
              className="w-full sm:w-auto"
            >
              選択したツリーを削除
            </Button>
          </div>
          <div className="space-y-4">
            {threadPosts.map((threadPost: { id: string; text: string; translatedText?: string | null; mediaJson?: string | null; threadOrder: number }) => (
              <div key={threadPost.id} className="rounded-xl bg-border-light px-4 py-3">
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-text-muted">
                  <input
                    type="checkbox"
                    checked={selectedThreadIds.includes(threadPost.id)}
                    onChange={() => handleToggleThread(threadPost.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  {threadPost.threadOrder + 1}投稿目
                </label>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                  {threadPost.text}
                </p>
                {threadPost.translatedText && (
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm leading-relaxed text-text-secondary">
                    日本語訳: {threadPost.translatedText}
                  </p>
                )}
                <PostMediaGrid media={parsePostMedia(threadPost.mediaJson)} />
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="flex-1">
          <Button variant="secondary" className="w-full">
            別の候補を見る
          </Button>
        </Link>
        <Link href={`/posts/${postId}/learning`} className="flex-1">
          <Button variant="secondary" className="w-full">
            <BookOpen className="w-4 h-4 mr-2" />
            学ぶ
          </Button>
        </Link>
        <Button
          onClick={handleStartDeepDive}
          loading={creatingDeepDive}
          loadingLabel="開始中..."
          className="flex-1"
        >
          深掘りを始める
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
