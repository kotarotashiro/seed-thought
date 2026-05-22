"use client";

import { useEffect, useState } from "react";
import { Download, Image as ImageIcon, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
  explanationPrompt,
  diagramPrompt,
}: {
  cardId: string;
  explanationPrompt: string;
  diagramPrompt: string;
}) {
  const [images, setImages] = useState<CardImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

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

  const generate = async (kind: "explanation" | "diagram" | "custom", prompt?: string) => {
    setGenerating(kind);
    setError(null);
    try {
      const res = await fetch(`/api/learning-cards/${cardId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...(prompt ? { prompt } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "画像生成に失敗しました");
      setImages((prev) => [data.image, ...prev]);
      if (kind === "custom") setCustomPrompt("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(null);
    }
  };

  const remove = async (imageId: string) => {
    if (!confirm("この画像を削除しますか？")) return;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => generate("explanation")}
          loading={generating === "explanation"}
          loadingLabel="生成中..."
          disabled={!explanationPrompt}
        >
          <Wand2 className="mr-1.5 h-4 w-4" />
          解説画像を生成
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => generate("diagram")}
          loading={generating === "diagram"}
          loadingLabel="生成中..."
          disabled={!diagramPrompt}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          図解を生成
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
            placeholder="自由なプロンプトを入力..."
            rows={3}
            className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <Button
            size="sm"
            onClick={() => generate("custom", customPrompt)}
            loading={generating === "custom"}
            loadingLabel="生成中..."
            disabled={!customPrompt.trim()}
          >
            <Wand2 className="mr-1.5 h-4 w-4" />
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
          画像を読み込み中…
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-4 py-6 text-center text-sm text-text-muted">
          <ImageIcon className="mx-auto mb-2 h-6 w-6 opacity-50" />
          まだ画像はありません。上のボタンから生成してください。
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((img) => (
            <div key={img.id} className="overflow-hidden rounded-2xl border border-border bg-white">
              <img
                src={`data:${img.mimeType};base64,${img.dataBase64}`}
                alt={img.prompt.slice(0, 80)}
                className="w-full"
              />
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span className="rounded-full bg-border-light px-2 py-0.5">
                    {img.kind === "explanation" ? "解説" : img.kind === "diagram" ? "図解" : "カスタム"}
                  </span>
                  <span>{new Date(img.createdAt).toLocaleString("ja-JP")}</span>
                </div>
                <p className="line-clamp-3 text-xs text-text-secondary">{img.prompt}</p>
                <div className="flex gap-2">
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
    </div>
  );
}
