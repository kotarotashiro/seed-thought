import { Play } from "lucide-react";

export interface PostMediaItem {
  type: "photo" | "video" | "animated_gif";
  url: string | null;
  previewUrl: string | null;
  altText: string | null;
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

export function PostMediaGrid({ media }: { media: PostMediaItem[] }) {
  if (media.length === 0) return null;

  const isSingle = media.length === 1;

  return (
    <div className={`mt-3 overflow-hidden rounded-xl ${isSingle ? "" : "grid grid-cols-2 gap-1"}`}>
      {media.slice(0, 4).map((item, index) => {
        const isVideo = item.type === "video" || item.type === "animated_gif";
        const previewSrc = item.previewUrl || item.url;
        const videoSrc = item.url;

        return (
          <div
            key={`${previewSrc}-${index}`}
            className={`relative overflow-hidden bg-border-light ${isSingle ? "aspect-[16/9]" : "aspect-square"}`}
          >
            {isVideo && videoSrc ? (
              <video
                src={videoSrc}
                poster={previewSrc ?? undefined}
                controls
                preload="none"
                playsInline
                className="h-full w-full object-cover"
              />
            ) : previewSrc ? (
              <img
                src={previewSrc}
                alt={item.altText || ""}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-border-light">
                {isVideo && <Play className="w-8 h-8 text-text-muted" />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
