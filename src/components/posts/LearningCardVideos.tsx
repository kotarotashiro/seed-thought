"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Loader2, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/DialogProvider";

interface CardVideo {
  id: string;
  prompt: string;
  status: "pending" | "processing" | "done" | "failed";
  videoId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<CardVideo["status"], string> = {
  pending: "待機中",
  processing: "生成中",
  done: "完了",
  failed: "失敗",
};

export function LearningCardVideos({ cardId }: { cardId: string }) {
  const confirm = useConfirm();
  const [videos, setVideos] = useState<CardVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/learning-cards/${cardId}/videos`);
        const data = await res.json();
        if (!cancelled) setVideos(Array.isArray(data) ? data : []);
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

  // Poll pending/processing jobs every 8s
  useEffect(() => {
    const inProgress = videos.filter(
      (v) => v.status === "pending" || v.status === "processing"
    );
    if (inProgress.length === 0) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;

    pollRef.current = window.setInterval(async () => {
      for (const v of inProgress) {
        try {
          const res = await fetch(
            `/api/learning-cards/${cardId}/videos?videoId=${v.id}`,
            { method: "PATCH" }
          );
          if (res.ok) {
            const updated = await res.json();
            setVideos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }
        } catch {
          // ignore
        }
      }
    }, 8000) as unknown as number;

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [videos, cardId]);

  const deleteVideo = async (videoId: string) => {
    const ok = await confirm({
      message: "この動画を削除しますか？",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    setDeleting(videoId);
    try {
      const res = await fetch(
        `/api/learning-cards/${cardId}/videos?videoId=${videoId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== videoId));
      } else {
        const data = await res.json();
        setError(data.error || "削除に失敗しました");
      }
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-border-light px-4 py-3">
        <p className="text-sm font-medium text-text">動画の新規生成は停止中です</p>
        <p className="mt-1 text-xs text-text-secondary">
          生成済み動画の再生・状態確認・削除は引き続き利用できます。
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          動画を読み込み中…
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-4 py-6 text-center text-sm text-text-muted">
          <Film className="mx-auto mb-2 h-6 w-6 opacity-50" />
          保存済みの動画はありません。
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {videos.map((v) => (
            <div key={v.id} className="overflow-hidden rounded-2xl border border-border bg-white">
              {v.videoUrl ? (
                <video
                  src={v.videoUrl}
                  poster={v.thumbnailUrl ?? undefined}
                  controls
                  className="w-full"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-border-light">
                  {v.status === "processing" || v.status === "pending" ? (
                    <div className="flex flex-col items-center gap-2 text-text-secondary">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs">{STATUS_LABEL[v.status]}…</span>
                    </div>
                  ) : (
                    <div className="text-xs text-danger">
                      {v.errorMessage || STATUS_LABEL[v.status]}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span className="rounded-full bg-border-light px-2 py-0.5">
                    {STATUS_LABEL[v.status]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{new Date(v.createdAt).toLocaleString("ja-JP")}</span>
                    <button
                      type="button"
                      onClick={() => deleteVideo(v.id)}
                      disabled={deleting === v.id}
                      aria-label="動画を削除"
                      className="rounded p-0.5 text-text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-40 transition-colors"
                    >
                      {deleting === v.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="line-clamp-3 text-xs text-text-secondary">{v.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
