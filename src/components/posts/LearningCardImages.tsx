"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Trash2,
  X as CloseIcon,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/DialogProvider";

interface CardImage {
  id: string;
  kind: string;
  prompt: string;
  mimeType: string;
  dataBase64: string;
  createdAt: string;
}

export function LearningCardImages({
  cardId,
}: {
  cardId: string;
  explanationPrompt: string;
  diagramPrompt: string;
}) {
  const confirm = useConfirm();
  const [images, setImages] = useState<CardImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<CardImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/learning-cards/${cardId}/images`);
        const data = await res.json();
        if (!cancelled) setImages(data.images || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  useEffect(() => {
    if (!lightboxImage) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxImage]);

  const remove = async (imageId: string) => {
    const ok = await confirm({
      message: "この画像を削除しますか？",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await fetch(`/api/learning-cards/${cardId}/images/${imageId}`, {
        method: "DELETE",
      });
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    } catch (e) {
      console.error(e);
    }
  };

  const download = (img: CardImage) => {
    const a = document.createElement("a");
    a.href = `data:${img.mimeType};base64,${img.dataBase64}`;
    a.download = `seedthought-${img.kind}-${img.id}.png`;
    a.click();
  };

  const kindLabel = (kind: string) =>
    kind === "explanation" ? "解説" : kind === "diagram" ? "図解" : "カスタム";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-border-light px-4 py-3">
        <p className="text-sm font-medium text-text">画像の新規生成は停止中です</p>
        <p className="mt-1 text-xs text-text-secondary">
          生成済み画像の閲覧・保存・削除は引き続き利用できます。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          画像を読み込み中…
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-4 py-6 text-center text-sm text-text-muted">
          <ImageIcon className="mx-auto mb-2 h-6 w-6 opacity-50" />
          保存済みの画像はありません。
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-2xl border border-border bg-white"
            >
              <button
                type="button"
                onClick={() => setLightboxImage(img)}
                className="group relative w-full"
                aria-label="クリックして拡大"
              >
                <img
                  src={`data:${img.mimeType};base64,${img.dataBase64}`}
                  alt={img.prompt.slice(0, 80)}
                  className="w-full"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span className="rounded-full bg-border-light px-2 py-0.5">
                    {kindLabel(img.kind)}
                  </span>
                  <span>{new Date(img.createdAt).toLocaleString("ja-JP")}</span>
                </div>
                <p className="line-clamp-3 text-xs text-text-secondary">{img.prompt}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => download(img)}>
                    <Download className="mr-1 h-3.5 w-3.5" />
                    保存
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(img.id)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    削除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 shadow-lg"
              aria-label="閉じる"
            >
              <CloseIcon className="h-4 w-4 text-text" />
            </button>
            <img
              src={`data:${lightboxImage.mimeType};base64,${lightboxImage.dataBase64}`}
              alt={lightboxImage.prompt.slice(0, 80)}
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            />
            <p className="mt-2 text-center text-xs text-white/70">
              {lightboxImage.prompt.slice(0, 120)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
