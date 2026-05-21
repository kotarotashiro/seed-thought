"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PostTypeBadge, SavedTypeBadge, Badge, LearningStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import { PostChatModal } from "@/components/posts/PostChatModal";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Square,
  Trash2,
  User,
  ExternalLink,
  MessageCircle,
  Newspaper,
  Clipboard,
  Pencil,
  Loader2,
} from "lucide-react";

interface ArticlePreview {
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

interface PostCardProps {
  post: {
    id: string;
    text: string;
    translatedText?: string | null;
    mediaJson?: string | null;
    urlCardJson?: string | null;
    sourceUrl?: string | null;
    authorName?: string | null;
    authorUsername?: string | null;
    authorAvatarUrl?: string | null;
    savedAt: Date | string;
    savedType?: string;
    threadPosts?: { id: string }[];
    deepDiveSessions?: { id: string; status: string }[];
    learningCard?: { id: string; status: string } | null;
    classification?: {
      postType: string;
      primaryCategory: string;
      summary?: string;
      recommendReason?: string;
    } | null;
  };
  showRecommendReason?: boolean;
  showLearningButton?: boolean;
  onDelete?: (id: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const URL_ONLY_RE = /^https?:\/\/\S+$/;
const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;

function isUrlLikeText(s: string | null | undefined): boolean {
  return !!s && URL_ONLY_RE.test(s.trim());
}

function getExpandedUrl(urlCardJson?: string | null): string | null {
  if (!urlCardJson) return null;
  try {
    const c = JSON.parse(urlCardJson) as { expandedUrl?: string; title?: string; description?: string };
    if (c.expandedUrl) return c.expandedUrl;
    // Some X entities store the resolved URL in title/description
    if (c.title && URL_ONLY_RE.test(c.title.trim())) return c.title.trim();
    if (c.description && URL_ONLY_RE.test(c.description.trim())) return c.description.trim();
    return null;
  } catch { return null; }
}

export function PostCard({
  post,
  showRecommendReason = false,
  showLearningButton = false,
  onDelete,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: PostCardProps) {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(false);
  const [article, setArticle] = useState<ArticlePreview | null>(() => {
    if (!post.urlCardJson) return null;
    try {
      const c = JSON.parse(post.urlCardJson) as { expandedUrl?: string; title?: string; description?: string; imageUrl?: string };
      const cleanTitle = isUrlLikeText(c.title) ? null : (c.title ?? null);
      const cleanDescription = isUrlLikeText(c.description) ? null : (c.description ?? null);
      if (!cleanTitle && !cleanDescription) return null;
      return { finalUrl: c.expandedUrl ?? post.text.trim(), title: cleanTitle, description: cleanDescription, image: c.imageUrl ?? null };
    } catch { return null; }
  });
  const [articleLoading, setArticleLoading] = useState(false);
  const autoFetchedRef = useRef(false);

  // X Article paste state
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pastedContent, setPastedContent] = useState<string | null>(() => {
    if (!post.urlCardJson) return null;
    try {
      const c = JSON.parse(post.urlCardJson) as { pastedContent?: string; pastedByUser?: boolean };
      return (c.pastedByUser && c.pastedContent) ? c.pastedContent : null;
    } catch { return null; }
  });

  const isUrlOnly = URL_ONLY_RE.test(post.text.trim());
  const articleUrl = isUrlOnly ? post.text.trim() : null;
  const initialExpandedUrl = getExpandedUrl(post.urlCardJson);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(initialExpandedUrl);
  const isXArticle = resolvedUrl ? X_ARTICLE_RE.test(resolvedUrl) : false;

  useEffect(() => {
    if (!isUrlOnly || article !== null || autoFetchedRef.current) return;
    // Skip auto-fetch for X Articles — Grok cannot read X Article body content;
    // the UI shows a graceful "Xで開く" link instead.
    if (isXArticle) return;
    autoFetchedRef.current = true;

    let fetchUrl = articleUrl!;
    if (post.urlCardJson) {
      try {
        const c = JSON.parse(post.urlCardJson) as { expandedUrl?: string };
        if (c.expandedUrl) fetchUrl = c.expandedUrl;
      } catch { /* ignore */ }
    }

    setArticleLoading(true);
    fetch(`/api/fetch-article?url=${encodeURIComponent(fetchUrl)}`)
      .then(r => r.json())
      .then((data: Partial<ArticlePreview> & { error?: string; isXArticle?: boolean }) => {
        if (data.finalUrl) setResolvedUrl(data.finalUrl);
        if (data.error || data.isXArticle) return;
        const cleanTitle = isUrlLikeText(data.title) ? null : (data.title ?? null);
        const cleanDescription = isUrlLikeText(data.description) ? null : (data.description ?? null);
        if (cleanTitle || cleanDescription) {
          setArticle({ finalUrl: data.finalUrl ?? fetchUrl, title: cleanTitle, description: cleanDescription, image: data.image ?? null });
        }
      })
      .catch(() => { /* silently fail */ })
      .finally(() => setArticleLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const savedDate = new Date(post.savedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const fetchArticle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!articleUrl || articleLoading) return;
    setArticleLoading(true);

    let fetchUrl = articleUrl;
    if (post.urlCardJson) {
      try {
        const c = JSON.parse(post.urlCardJson) as { expandedUrl?: string };
        if (c.expandedUrl) fetchUrl = c.expandedUrl;
      } catch { /* ignore */ }
    }

    try {
      const res = await fetch(`/api/fetch-article?url=${encodeURIComponent(fetchUrl)}`);
      const data = (await res.json()) as Partial<ArticlePreview> & { error?: string; isXArticle?: boolean };
      if (data.finalUrl) setResolvedUrl(data.finalUrl);
      if (data.error || data.isXArticle) return;
      const cleanTitle = isUrlLikeText(data.title) ? null : (data.title ?? null);
      const cleanDescription = isUrlLikeText(data.description) ? null : (data.description ?? null);
      if (cleanTitle || cleanDescription) {
        setArticle({ finalUrl: data.finalUrl ?? fetchUrl, title: cleanTitle, description: cleanDescription, image: data.image ?? null });
      }
    } catch {
      // silently fail; user can retry
    } finally {
      setArticleLoading(false);
    }
  };

  const handlePasteSave = async (e: React.MouseEvent) => {
    stop(e);
    const text = pasteValue.trim();
    if (!text || pasteSaving) return;
    setPasteSaving(true);

    let existingCard: Record<string, unknown> = {};
    try {
      if (post.urlCardJson) existingCard = JSON.parse(post.urlCardJson) as Record<string, unknown>;
    } catch { /* ignore */ }

    const newCard = {
      ...existingCard,
      expandedUrl: resolvedUrl ?? (existingCard.expandedUrl as string | undefined),
      pastedContent: text,
      pastedByUser: true,
    };

    setPasteError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlCardJson: JSON.stringify(newCard) }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "保存に失敗しました");
      }
      setPastedContent(text);
      setPasteOpen(false);
      setPasteValue("");
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setPasteSaving(false);
    }
  };

  const handleCardClick = () => {
    if (selectMode && onToggleSelect) {
      onToggleSelect(post.id);
      return;
    }
    router.push(`/posts/${post.id}/confirm`);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <Card
        hoverable
        className={`group relative flex flex-col cursor-pointer ${
          selectMode
            ? selected
              ? "ring-2 ring-accent"
              : "ring-2 ring-dashed ring-accent/40 hover:ring-accent/60"
            : ""
        }`}
        onClick={handleCardClick}
      >
        {selectMode && (
          <div className="absolute top-3 right-3 z-10">
            {selected ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent shadow-sm">
                <CheckSquare className="h-4 w-4 text-white" />
              </div>
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-text-muted bg-white">
                <Square className="h-3.5 w-3.5 text-text-muted" />
              </div>
            )}
          </div>
        )}

        {/* Author Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center flex-shrink-0 overflow-hidden">
            {post.authorAvatarUrl ? (
              <img src={post.authorAvatarUrl} alt={post.authorName || ""} className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-accent" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text truncate">
              {post.authorName || "手動追加"}
            </p>
            <p className="text-xs text-text-muted">
              {post.authorUsername ? `@${post.authorUsername}` : "手動入力"} ・ {savedDate}
            </p>
          </div>
        </div>

        {/* Post Text */}
        {isUrlOnly ? (
          <p className="text-xs text-text-muted mb-3 truncate">{post.text.trim()}</p>
        ) : (
          <p className="text-sm text-text leading-relaxed mb-4 line-clamp-3">{post.text}</p>
        )}

        {/* Translation */}
        {post.translatedText && !isUrlOnly && (
          <div className="mb-4 rounded-xl border border-border bg-border-light px-3 py-2">
            <p className="mb-0.5 text-xs font-semibold text-text-secondary">日本語訳</p>
            <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">{post.translatedText}</p>
          </div>
        )}

        {/* URL article preview */}
        {isUrlOnly && (
          <div className="mb-3" onClick={stop}>
            {isXArticle && resolvedUrl ? (
              <div className="space-y-2">
                {/* Always show the "open in X" link */}
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-text-secondary py-2 px-3 rounded-xl border border-border hover:border-accent/40 transition-colors"
                  onClick={stop}
                >
                  <Newspaper className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
                  <span className="flex-1 truncate">X Article（Xアプリで開く）</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
                {/* Pasted content preview */}
                {pastedContent && !pasteOpen && (
                  <div className="relative rounded-xl border border-border bg-border-light px-3 py-2">
                    <p className="line-clamp-3 whitespace-pre-wrap pr-7 text-xs leading-relaxed text-text-secondary">
                      {pastedContent}
                    </p>
                    <button
                      className="absolute top-2 right-2 p-0.5 text-text-muted hover:text-accent transition-colors"
                      onClick={(e) => { stop(e); setPasteValue(pastedContent); setPasteOpen(true); }}
                      title="編集"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {/* Paste toggle button (shown only when no content and panel closed) */}
                {!pasteOpen && !pastedContent && (
                  <button
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors py-1.5 rounded-xl border border-dashed border-border hover:border-accent/40"
                    onClick={(e) => { stop(e); setPasteOpen(true); }}
                  >
                    <Clipboard className="w-3 h-3" />
                    記事テキストを貼り付ける
                  </button>
                )}
                {/* Paste panel */}
                {pasteOpen && (
                  <div className="space-y-2" onClick={stop}>
                    <textarea
                      value={pasteValue}
                      onChange={(e) => setPasteValue(e.target.value)}
                      placeholder="X記事のテキストをここに貼り付けてください..."
                      className="w-full rounded-xl border border-border bg-white text-xs p-3 text-text resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      rows={5}
                      autoFocus
                    />
                    {pasteError && (
                      <p className="text-xs text-danger">{pasteError}</p>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { stop(e); setPasteOpen(false); setPasteValue(""); setPasteError(null); }}
                      >
                        キャンセル
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handlePasteSave}
                        disabled={!pasteValue.trim() || pasteSaving}
                      >
                        {pasteSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "保存"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : article ? (
              <a
                href={article.finalUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-border overflow-hidden hover:border-accent/40 transition-colors"
                onClick={stop}
              >
                {article.image && (
                  <img
                    src={article.image}
                    alt=""
                    className="w-full h-36 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="px-3 py-2">
                  {article.title && (
                    <p className="text-sm font-medium text-text line-clamp-2 mb-1">{article.title}</p>
                  )}
                  {article.description && (
                    <p className="text-xs text-text-secondary line-clamp-2">{article.description}</p>
                  )}
                </div>
              </a>
            ) : articleLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-muted py-2 px-3 rounded-xl border border-border">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span>記事を読み込み中...</span>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={fetchArticle}
              >
                <Newspaper className="w-3.5 h-3.5 mr-1.5" />
                記事を読み込む
              </Button>
            )}
          </div>
        )}

        <PostMediaGrid media={parsePostMedia(post.mediaJson)} sourceUrl={post.sourceUrl} className="max-h-[220px]" />

        {/* Classification Badges */}
        {post.classification && (
          <div className="flex flex-wrap gap-2 mb-3 mt-2">
            <PostTypeBadge type={post.classification.postType} />
            <Badge>{post.classification.primaryCategory}</Badge>
            {post.savedType && <SavedTypeBadge type={post.savedType} />}
            {(post.threadPosts?.length ?? 0) > 0 && (
              <Badge variant="success">ツリー {(post.threadPosts?.length ?? 0) + 1}投稿</Badge>
            )}
            {(post.deepDiveSessions?.length ?? 0) > 0 && (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                深掘り済み
              </Badge>
            )}
            <LearningStatusBadge learningCard={post.learningCard} />
          </div>
        )}

        {/* Recommend Reason */}
        {showRecommendReason && post.classification?.recommendReason && (
          <div className="mb-4 rounded-xl bg-accent-subtle px-4 py-3">
            <p className="mb-1 text-xs font-medium text-accent">💡 おすすめ理由</p>
            <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
              {post.classification.recommendReason}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-1.5 pt-2" onClick={stop}>
          <Link href={`/posts/${post.id}/confirm`} className="min-w-0 flex-1" onClick={stop}>
            <Button variant="primary" size="sm" className="w-full group-hover:shadow-md">
              深掘る
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
          {showLearningButton && (
            <Link href={`/posts/${post.id}/learning`} onClick={stop}>
              <Button variant="ghost" size="sm" title="学ぶ">
                <BookOpen className="w-4 h-4" />
              </Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            title="この投稿についてチャット"
            onClick={(e) => { stop(e); setChatOpen(true); }}
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          {(post.sourceUrl || articleUrl) && (
            <a
              href={post.sourceUrl || articleUrl!}
              target="_blank"
              rel="noreferrer"
              onClick={stop}
            >
              <Button variant="ghost" size="sm" title="元記事を開く">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              title="削除"
              onClick={(e) => { stop(e); onDelete(post.id); }}
            >
              <Trash2 className="w-4 h-4 text-danger" />
            </Button>
          )}
        </div>
      </Card>

      {chatOpen && (
        <PostChatModal
          post={{ id: post.id, text: post.text, authorName: post.authorName, classification: post.classification ?? null }}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}
