"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PostTypeBadge, SavedTypeBadge, Badge, LearningStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import { PostChatModal } from "@/components/posts/PostChatModal";
import {
  ArrowRight,
  CheckCircle2,
  User,
  ExternalLink,
  MessageCircle,
  Newspaper,
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
      summary: string;
      recommendReason: string;
    } | null;
  };
  showRecommendReason?: boolean;
}

const URL_ONLY_RE = /^https?:\/\/\S+$/;

export function PostCard({ post, showRecommendReason = false }: PostCardProps) {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(false);
  const [article, setArticle] = useState<ArticlePreview | null>(() => {
    if (!post.urlCardJson) return null;
    try {
      const c = JSON.parse(post.urlCardJson);
      return { finalUrl: c.expandedUrl, title: c.title, description: c.description, image: c.imageUrl };
    } catch { return null; }
  });
  const [articleLoading, setArticleLoading] = useState(false);

  const savedDate = new Date(post.savedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const isUrlOnly = URL_ONLY_RE.test(post.text.trim());
  const articleUrl = isUrlOnly ? post.text.trim() : null;

  const fetchArticle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!articleUrl || articleLoading) return;
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/fetch-article?url=${encodeURIComponent(articleUrl)}`);
      const data = await res.json();
      setArticle(data);
    } catch {
      setArticle({ finalUrl: articleUrl, title: null, description: "記事を読み込めませんでした", image: null });
    } finally {
      setArticleLoading(false);
    }
  };

  const handleCardClick = () => {
    router.push(`/posts/${post.id}/confirm`);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <Card
        hoverable
        className="group flex flex-col cursor-pointer"
        onClick={handleCardClick}
      >
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
          <p className="mb-4 rounded-xl bg-accent-subtle px-3 py-2 text-xs leading-relaxed text-text-secondary">
            日本語訳: {post.translatedText}
          </p>
        )}

        {/* URL article preview */}
        {isUrlOnly && (
          <div className="mb-3" onClick={stop}>
            {article ? (
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
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={fetchArticle}
                disabled={articleLoading}
              >
                {articleLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Newspaper className="w-3.5 h-3.5 mr-1.5" />
                )}
                記事を読み込む
              </Button>
            )}
          </div>
        )}

        <PostMediaGrid media={parsePostMedia(post.mediaJson)} sourceUrl={post.sourceUrl} />

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
          <div className="bg-accent-subtle rounded-xl px-4 py-3 mb-4">
            <p className="text-xs font-medium text-accent mb-1">💡 おすすめ理由</p>
            <p className="text-xs text-text-secondary leading-relaxed">
              {post.classification.recommendReason}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-1.5 pt-2" onClick={stop}>
          <Link href={`/posts/${post.id}/confirm`} className="flex-1" onClick={stop}>
            <Button variant="primary" size="sm" className="w-full group-hover:shadow-md">
              深掘る
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
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
