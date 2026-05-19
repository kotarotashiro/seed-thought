import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PostTypeBadge, SavedTypeBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import { ArrowRight, CheckCircle2, User } from "lucide-react";

interface PostCardProps {
  post: {
    id: string;
    text: string;
    translatedText?: string | null;
    mediaJson?: string | null;
    authorName?: string | null;
    authorUsername?: string | null;
    authorAvatarUrl?: string | null;
    savedAt: Date | string;
    savedType?: string;
    threadPosts?: { id: string }[];
    deepDiveSessions?: { id: string; status: string }[];
    classification?: {
      postType: string;
      primaryCategory: string;
      summary: string;
      recommendReason: string;
    } | null;
  };
  showRecommendReason?: boolean;
}

export function PostCard({ post, showRecommendReason = false }: PostCardProps) {
  const savedDate = new Date(post.savedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Card hoverable className="group">
      {/* Author Info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center flex-shrink-0 overflow-hidden">
          {post.authorAvatarUrl ? (
            <img
              src={post.authorAvatarUrl}
              alt={post.authorName || ""}
              className="w-full h-full object-cover"
            />
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
      <p className="text-sm text-text leading-relaxed mb-4 line-clamp-3">
        {post.text}
      </p>
      {post.translatedText && (
        <p className="mb-4 rounded-xl bg-accent-subtle px-3 py-2 text-xs leading-relaxed text-text-secondary">
          日本語訳: {post.translatedText}
        </p>
      )}
      <PostMediaGrid media={parsePostMedia(post.mediaJson)} />

      {/* Classification Badges */}
      {post.classification && (
        <div className="flex flex-wrap gap-2 mb-3">
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

      {/* Action */}
      <Link href={`/posts/${post.id}/confirm`}>
        <Button
          variant="primary"
          size="sm"
          className="w-full group-hover:shadow-md"
        >
          この投稿を深掘る
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </Card>
  );
}
