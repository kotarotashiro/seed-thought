import { PostTypeBadge, Badge } from "@/components/ui/Badge";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import { User } from "lucide-react";

interface PostMiniCardProps {
  post: {
    text: string;
    translatedText?: string | null;
    mediaJson?: string | null;
    authorName?: string | null;
    authorUsername?: string | null;
    authorAvatarUrl?: string | null;
    classification?: {
      postType: string;
      primaryCategory: string;
    } | null;
  };
}

export function PostMiniCard({ post }: PostMiniCardProps) {
  return (
    <div className="bg-border-light rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-accent-light flex items-center justify-center flex-shrink-0 overflow-hidden">
          {post.authorAvatarUrl ? (
            <img
              src={post.authorAvatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-3 h-3 text-accent" />
          )}
        </div>
        <span className="text-xs text-text-secondary truncate">
          {post.authorName || "手動追加"}
          {post.authorUsername && ` @${post.authorUsername}`}
        </span>
      </div>
      <p className="text-sm text-text leading-relaxed line-clamp-2 mb-2">
        {post.text}
      </p>
      {post.translatedText && (
        <p className="mb-2 line-clamp-2 rounded-lg bg-white/70 px-2 py-1.5 text-xs leading-relaxed text-text-secondary">
          日本語訳: {post.translatedText}
        </p>
      )}
      <PostMediaGrid media={parsePostMedia(post.mediaJson)} />
      {post.classification && (
        <div className="flex gap-2">
          <PostTypeBadge type={post.classification.postType} />
          <Badge>{post.classification.primaryCategory}</Badge>
        </div>
      )}
    </div>
  );
}
