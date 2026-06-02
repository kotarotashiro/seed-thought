import { Play } from "lucide-react";

export interface PostMediaItem {
  type: "photo" | "video" | "animated_gif";
  url: string | null;
  previewUrl: string | null;
  altText: string | null;
  /** ビジョンモデルが読み取った画像の中身（あれば） */
  description?: string | null;
}

export function parsePostMedia(mediaJson?: string | null): PostMediaItem[] {
  if (!mediaJson) return [];
  try {
    const media = JSON.parse(mediaJson);
    if (!Array.isArray(media)) return [];
    return media.filter((item): item is PostMediaItem => {
      return (
        item &&
        typeof item === "object" &&
        ["photo", "video", "animated_gif"].includes(item.type) &&
        (typeof item.url === "string" || typeof item.previewUrl === "string")
      );
    });
  } catch {
    return [];
  }
}

export function PostMediaGrid({
  media,
  sourceUrl,
  className,
}: {
  media: PostMediaItem[];
  sourceUrl?: string | null;
  className?: string;
}) {
  if (media.length === 0) return null;

  const isSingle = media.length === 1;

  return (
    <div className={`mt-3 overflow-hidden rounded-xl ${isSingle ? "" : "grid grid-cols-2 gap-1"} ${className ?? ""}`}>
      {media.slice(0, 4).map((item, index) => {
        const isVideo = item.type === "video" || item.type === "animated_gif";
        const previewSrc = item.previewUrl || item.url;

        return (
          <div
            key={`${previewSrc}-${index}`}
            className={`relative overflow-hidden bg-border-light ${isSingle ? "aspect-[16/9]" : "aspect-square"}`}
          >
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={item.altText || ""}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-border-light" />
            )}
            {isVideo && (
              <a
                href={sourceUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                onClick={(e) => { if (!sourceUrl) e.preventDefault(); }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-md">
                  <Play className="w-5 h-5 text-text ml-0.5" />
                </div>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
