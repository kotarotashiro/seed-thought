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

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 overflow-hidden rounded-xl">
      {media.slice(0, 4).map((item, index) => {
        const src = item.previewUrl || item.url;
        if (!src) return null;
        const isVideo = item.type === "video" || item.type === "animated_gif";

        return (
          <div key={`${src}-${index}`} className="relative aspect-video overflow-hidden bg-border-light">
            <img
              src={src}
              alt={item.altText || ""}
              className="h-full w-full object-cover"
            />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white">
                  <Play className="h-4 w-4 fill-current" />
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
