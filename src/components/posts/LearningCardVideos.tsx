"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
  const [videos, setVideos] = useState<CardVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
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

  const submit = async (prompt?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/learning-cards/${cardId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt ? { prompt } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "動画生成に失敗しました");
      setVideos((prev) => [data, ...prev]);
      setCustomPrompt("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => submit()}
          loading={submitting}
          loadingLabel="送信中..."
        >
          <Film className="mr-1.5 h-4 w-4" />
          このカードから動画を生成
        </Button>
      </div>

      <details className="rounded-xl border border-border bg-white">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-text-secondary hover:text-text">
          カスタムプロンプトで生成
        </summary>
        <div className="space-y-2 border-t border-border-light p-3">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="動画の内容を自由に指定..."
            rows={3}
            className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <Button
            size="sm"
            onClick={() => submit(customPrompt)}
            loading={submitting}
            loadingLabel="送信中..."
            disabled={!customPrompt.trim()}
          >
            <Film className="mr-1.5 h-4 w-4" />
            この内容で生成
          </Button>
        </div>
      </details>

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
          まだ動画はありません。上のボタンから生成してください。<br />
          <span className="text-xs">※ 生成には数分かかります</span>
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
                  <span>{new Date(v.createdAt).toLocaleString("ja-JP")}</span>
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
