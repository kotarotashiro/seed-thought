"use client";

import { useState, useEffect, use } from "react";
import { useSafeBack } from "@/hooks/useSafeBack";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/DialogProvider";
import { PostTypeBadge, Badge, LearningStatusBadge } from "@/components/ui/Badge";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import { LinkifiedText } from "@/components/ui/LinkifiedText";
import { OpenInXButton } from "@/components/ui/OpenInXButton";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  GitBranch,
  Languages,
  Newspaper,
  User,
} from "lucide-react";

const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;

export default function ConfirmPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const safeBack = useSafeBack();
  const confirm = useConfirm();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingThread, setFetchingThread] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [threadMessage, setThreadMessage] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  // 強制追記モード
  const [manualThreadOpen, setManualThreadOpen] = useState(false);
  const [manualThreadUrl, setManualThreadUrl] = useState("");
  const [manualThreadText, setManualThreadText] = useState("");
  const [addingManualThread, setAddingManualThread] = useState(false);
  // 記事 / 字幕の追加
  const [articleUrl, setArticleUrl] = useState("");
  const [fetchingArticle, setFetchingArticle] = useState(false);
  const [articleMessage, setArticleMessage] = useState<string | null>(null);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [transcriptMessage, setTranscriptMessage] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  // 投稿内リンクの enrichment
  const [enrichingLinks, setEnrichingLinks] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  type RelatedLink = {
    url: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
  };
  const [relatedLinks, setRelatedLinks] = useState<RelatedLink[]>([]);

  const loadPost = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}`);
      const data = await res.json();
      setPost(data);
      // urlCardJson.relatedLinks を抽出
      try {
        const parsed = data?.urlCardJson ? JSON.parse(data.urlCardJson) : null;
        if (parsed && Array.isArray(parsed.relatedLinks)) {
          setRelatedLinks(parsed.relatedLinks);
        } else {
          setRelatedLinks([]);
        }
      } catch {
        setRelatedLinks([]);
      }
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
        if (cancelled) return;
        setPost(data);
        try {
          const parsed = data?.urlCardJson ? JSON.parse(data.urlCardJson) : null;
          if (parsed && Array.isArray(parsed.relatedLinks)) {
            setRelatedLinks(parsed.relatedLinks);
          }
        } catch { /* ignore */ }
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

  // 投稿内に含まれる全URLの情報を取得
  const handleEnrichLinks = async () => {
    setEnrichingLinks(true);
    setEnrichMessage(null);
    setEnrichError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/enrich-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setEnrichError(data.error || "リンク情報の取得に失敗しました");
        return;
      }
      setRelatedLinks(Array.isArray(data.links) ? data.links : []);
      if (data.fetchedCount > 0) {
        setEnrichMessage(`${data.fetchedCount}件のリンク情報を取得しました。`);
      } else if (Array.isArray(data.links) && data.links.length > 0) {
        setEnrichMessage("既に取得済みのリンク情報を表示しています。");
      } else {
        setEnrichMessage("取得対象のリンクは見つかりませんでした。");
      }
      await loadPost();
    } catch {
      setEnrichError("リンク情報の取得に失敗しました");
    } finally {
      setEnrichingLinks(false);
    }
  };

  const handleAddArticle = async () => {
    const url = articleUrl.trim();
    if (!url) {
      setArticleError("記事URLを入力してください");
      return;
    }
    if (!/^https?:\/\//.test(url)) {
      setArticleError("URL は http(s) で始まる形式を入力してください");
      return;
    }
    setFetchingArticle(true);
    setArticleMessage(null);
    setArticleError(null);
    try {
      const res = await fetch(`/api/fetch-article?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) {
        setArticleError(data.error || "記事の取得に失敗しました");
        return;
      }
      const next = {
        expandedUrl: data.finalUrl || url,
        title: data.title || null,
        description: data.description || null,
        pastedContent: data.description || null,
        pastedByUser: false,
        isXArticle: Boolean(data.isXArticle),
        imageUrl: data.image || null,
      };
      const patch = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlCardJson: JSON.stringify(next) }),
      });
      if (!patch.ok) {
        const err = await patch.json().catch(() => ({}));
        setArticleError(err.error || "記事情報の保存に失敗しました");
        return;
      }
      setArticleMessage("記事情報を投稿に追加しました。");
      setArticleUrl("");
      await loadPost();
    } catch {
      setArticleError("記事の取得に失敗しました");
    } finally {
      setFetchingArticle(false);
    }
  };

  const handleSaveTranscript = async () => {
    const text = transcriptText.trim();
    if (!text) {
      setTranscriptError("動画文字起こしのテキストを入力してください");
      return;
    }
    setSavingTranscript(true);
    setTranscriptMessage(null);
    setTranscriptError(null);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoTranscriptText: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTranscriptError(err.error || "文字起こしの保存に失敗しました");
        return;
      }
      setTranscriptMessage("動画文字起こしを保存しました。");
      setTranscriptText("");
      await loadPost();
    } catch {
      setTranscriptError("文字起こしの保存に失敗しました");
    } finally {
      setSavingTranscript(false);
    }
  };

  const handleAddManualThread = async () => {
    const url = manualThreadUrl.trim();
    const text = manualThreadText.trim();
    if (!url && !text) {
      setThreadError("URL か 本文 を入力してください");
      return;
    }
    setAddingManualThread(true);
    setThreadMessage(null);
    setThreadError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/thread`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, text }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setThreadError(data.error || "ツリーへの追記に失敗しました");
        return;
      }
      setThreadMessage(
        data.source === "x_api"
          ? "X APIから取得して追記しました。"
          : "本文をそのまま追記しました。"
      );
      setManualThreadUrl("");
      setManualThreadText("");
      setManualThreadOpen(false);
      await loadPost();
    } catch {
      setThreadError("ツリーへの追記に失敗しました");
    } finally {
      setAddingManualThread(false);
    }
  };

  const handleDeleteSelectedThreads = async () => {
    if (selectedThreadIds.length === 0) return;
    const ok = await confirm({
      message: `選択したツリー投稿 ${selectedThreadIds.length}件を削除しますか？`,
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;

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

  const threadPosts = post.threadPosts || [];
  const canFetchThread = (post.source === "user_like" || post.source === "user_bookmark") && post.sourcePostId;
  const postMedia = parsePostMedia(post.mediaJson);

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      {/* Back Button */}
      <button
        onClick={safeBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>

      {/* Title */}
      <div>
        <h1 className="mb-2 text-xl font-bold text-text sm:text-2xl">投稿の詳細</h1>
        <p className="text-sm text-text-secondary">
          内容を確認し、必要なら情報を補ってから学習カードを生成できます。
        </p>
      </div>

      {/* Original Post */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center overflow-hidden flex-shrink-0">
              {post.authorAvatarUrl ? (
                <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-accent" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">{post.authorName || "手動追加"}</p>
              <p className="text-xs text-text-muted">
                {post.authorUsername ? `@${post.authorUsername}` : ""}
              </p>
            </div>
          </div>
          {post.sourceUrl && <OpenInXButton href={post.sourceUrl} />}
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
            const expandedUrl: string | undefined = urlCard.expandedUrl;
            const isXArticle = expandedUrl ? X_ARTICLE_RE.test(expandedUrl) : false;
            const pastedContent: string | null =
              urlCard.pastedByUser && typeof urlCard.pastedContent === "string"
                ? urlCard.pastedContent
                : null;
            const hasTitleOrDesc = !!(urlCard.title || urlCard.description);

            return (
              <>
                <p className="mb-3 whitespace-pre-wrap break-all text-xs text-text-muted">{post.text.trim()}</p>
                {isXArticle && expandedUrl ? (
                  <a
                    href={expandedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-text-secondary transition-colors hover:border-accent/40"
                  >
                    <Newspaper className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
                    <span className="flex-1 truncate">X Article（Xアプリで開く）</span>
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                  </a>
                ) : hasTitleOrDesc && expandedUrl ? (
                  <a
                    href={expandedUrl}
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
                        <p className="mb-1 text-sm font-medium text-text">{urlCard.title}</p>
                      )}
                      {urlCard.description && (
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{urlCard.description}</p>
                      )}
                      <p className="mt-1 break-all text-xs text-text-muted">{expandedUrl}</p>
                    </div>
                  </a>
                ) : expandedUrl ? (
                  <a
                    href={expandedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-text-secondary transition-colors hover:border-accent/40"
                  >
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="flex-1 break-all">{expandedUrl}</span>
                  </a>
                ) : null}
                {pastedContent && (
                  <div className="mt-3 rounded-xl border border-border bg-border-light px-4 py-3">
                    <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-text-secondary">
                      <Newspaper className="h-3.5 w-3.5 text-accent" />
                      記事テキスト（貼り付け済み）
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                      {pastedContent}
                    </p>
                  </div>
                )}
              </>
            );
          }
          return (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">
              <LinkifiedText text={post.text} />
            </p>
          );
        })()}
        {post.translatedText && (
          <div className="mt-3 rounded-xl border border-border bg-border-light px-4 py-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-text-secondary">
              <Languages className="h-3.5 w-3.5" />
              日本語訳
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
              {post.translatedText}
            </p>
          </div>
        )}
        <PostMediaGrid media={postMedia} />
        {post.videoTranscriptText && (
          <div className="mt-3 rounded-xl border border-border bg-border-light px-4 py-3">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-text-secondary">
              <Newspaper className="h-3.5 w-3.5 text-accent" />
              動画文字起こし（貼り付け済み）
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              {post.videoTranscriptText}
            </p>
          </div>
        )}
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
                disabled={fetchingThread || deletingThread || addingManualThread}
                loading={fetchingThread}
                loadingLabel="取得中..."
              >
                <GitBranch className="w-4 h-4 mr-1" />
                {threadPosts.length > 0 ? "ツリーを再取得" : "ツリーを取得"}
              </Button>
              <button
                type="button"
                onClick={() => setManualThreadOpen((v) => !v)}
                className="text-xs text-text-secondary underline-offset-2 hover:underline"
              >
                {manualThreadOpen ? "強制追記を閉じる" : "強制追記（URLや本文を直接入力）"}
              </button>
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
            {manualThreadOpen && (
              <div className="mt-3 rounded-xl border border-border bg-border-light/40 px-3 py-3 space-y-2">
                <p className="text-xs text-text-muted">
                  X APIで取れなかった続き投稿を、URL（推奨）または本文の直接入力で強制的に追記できます。
                </p>
                <input
                  type="text"
                  value={manualThreadUrl}
                  onChange={(e) => setManualThreadUrl(e.target.value)}
                  placeholder="https://x.com/.../status/123... または tweet ID"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
                />
                <textarea
                  value={manualThreadText}
                  onChange={(e) => setManualThreadText(e.target.value)}
                  placeholder="本文を直接入力（URLで取れないときの代わりとして使う）"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleAddManualThread}
                    disabled={addingManualThread || (!manualThreadUrl.trim() && !manualThreadText.trim())}
                    loading={addingManualThread}
                    loadingLabel="追記中..."
                  >
                    強制追記する
                  </Button>
                </div>
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
              選択した続き投稿だけ削除できます。学習カード生成時は、残っているツリー全体を含めます。
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
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">
                  <LinkifiedText text={threadPost.text} />
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

      {/* 補助情報の追加（記事URL / 動画文字起こし / 投稿内リンク） */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-accent" />
          <h3 className="text-base font-bold text-text">補助情報を追加</h3>
        </div>
        <p className="mb-4 text-xs text-text-muted">
          投稿に含まれる記事URLや、動画の文字起こしを追加すると、学習カードの精度が上がります。
        </p>

        {/* 投稿内リンクの自動取得 */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-text-secondary">
              投稿内に含まれる全リンクの情報を一括取得
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleEnrichLinks}
              disabled={enrichingLinks}
              loading={enrichingLinks}
              loadingLabel="取得中..."
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              リンク情報を取得
            </Button>
          </div>
          {enrichMessage && (
            <p className="text-xs text-success">{enrichMessage}</p>
          )}
          {enrichError && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-light px-3 py-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
              <p className="text-xs text-danger">{enrichError}</p>
            </div>
          )}
          {relatedLinks.length > 0 && (
            <div className="mt-2 space-y-2">
              {relatedLinks.map((link, idx) => (
                <a
                  key={`${link.url}-${idx}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-border bg-white px-3 py-2 transition-colors hover:border-accent/40"
                >
                  {link.title && (
                    <p className="mb-0.5 text-xs font-medium text-text">{link.title}</p>
                  )}
                  {link.description && (
                    <p className="line-clamp-2 text-xs text-text-secondary">{link.description}</p>
                  )}
                  <p className="mt-1 break-all text-[10px] text-text-muted">{link.url}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-border-light pt-4" />

        {/* 記事URL */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary">記事URLを追加</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={articleUrl}
              onChange={(e) => setArticleUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
            <Button
              size="sm"
              onClick={handleAddArticle}
              disabled={fetchingArticle || !articleUrl.trim()}
              loading={fetchingArticle}
              loadingLabel="取得中..."
            >
              取得して追加
            </Button>
          </div>
          {articleMessage && (
            <p className="text-xs text-success">{articleMessage}</p>
          )}
          {articleError && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-light px-3 py-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
              <p className="text-xs text-danger">{articleError}</p>
            </div>
          )}
        </div>

        {/* 動画文字起こし */}
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">動画の文字起こしを貼り付け</p>
          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder={post.videoTranscriptText ? "（既存の文字起こしを上書きします）" : "動画の文字起こしテキストを貼り付け..."}
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveTranscript}
              disabled={savingTranscript || !transcriptText.trim()}
              loading={savingTranscript}
              loadingLabel="保存中..."
            >
              文字起こしを保存
            </Button>
          </div>
          {transcriptMessage && (
            <p className="text-xs text-success">{transcriptMessage}</p>
          )}
          {transcriptError && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-light px-3 py-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
              <p className="text-xs text-danger">{transcriptError}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={`/posts/${postId}/learning`} className="flex-1">
          <Button className="w-full">
            <BookOpen className="w-4 h-4 mr-2" />
            学習カードを生成
          </Button>
        </Link>
      </div>

      {/* Bottom back button */}
      <button
        onClick={safeBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>
    </div>
  );
}
