"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ExternalLink, Library } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface PatternAssetView {
  id: string;
  name: string;
  structure: string;
  variableSlots: string[];
  transferScope: string;
  usageNote: string | null;
  tags: string[];
  status: "active" | "archived";
  createdAt: string;
  sourceCard: { learningCardId: string; title: string; sourcePostId: string } | null;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<PatternAssetView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      setError(false);
      try {
        const res = await fetch("/api/assets");
        if (!res.ok) throw new Error("assets failed");
        const data = (await res.json()) as { assets?: PatternAssetView[] };
        if (!cancelled) setAssets(data.assets ?? []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleAssets = useMemo(
    () => assets.filter((asset) => showArchived || asset.status !== "archived"),
    [assets, showArchived]
  );

  async function toggleStatus(asset: PatternAssetView) {
    const nextStatus = asset.status === "active" ? "archived" : "active";
    setUpdatingId(asset.id);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("update failed");
      setAssets((current) =>
        current.map((item) =>
          item.id === asset.id ? { ...item, status: nextStatus } : item
        )
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Library className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">
              資産庫
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-text-secondary">
            保存した投稿から抽出された、再利用できる型のライブラリ
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="h-4 w-4 rounded border-border text-accent"
          />
          アーカイブを表示
        </label>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-card p-5 animate-pulse">
              <div className="mb-4 h-4 w-1/2 rounded bg-border-light" />
              <div className="space-y-2">
                <div className="h-3 rounded bg-border-light" />
                <div className="h-3 w-5/6 rounded bg-border-light" />
                <div className="h-3 w-3/5 rounded bg-border-light" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <Card className="text-center py-10">
          <h3 className="font-semibold text-text mb-2">読み込みに失敗しました</h3>
          <p className="text-sm text-text-secondary">時間をおいてページを再読み込みしてください。</p>
        </Card>
      ) : visibleAssets.length === 0 ? (
        <Card className="text-center py-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent-light">
            <Archive className="h-7 w-7 text-accent" />
          </div>
          <h3 className="font-semibold text-text mb-2">まだ型がありません</h3>
          <p className="text-sm text-text-secondary">
            投稿を保存して学習カードを作ると、型が自動で貯まります
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleAssets.map((asset) => (
            <Card key={asset.id} className={asset.status === "archived" ? "opacity-70" : ""}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug text-text">{asset.name}</h2>
                  {asset.status === "archived" && (
                    <Badge className="mt-2" variant="warning">archived</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={updatingId === asset.id}
                  onClick={() => toggleStatus(asset)}
                  className="flex-shrink-0"
                >
                  {asset.status === "active" ? "アーカイブ" : "戻す"}
                </Button>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-text-secondary">
                {asset.structure}
              </p>

              {asset.variableSlots.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {asset.variableSlots.map((slot) => (
                    <Badge key={slot}>{slot}</Badge>
                  ))}
                </div>
              )}

              <div className="mb-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium text-text">転用範囲: </span>
                  <span className="text-text-secondary">{asset.transferScope}</span>
                </p>
                {asset.usageNote && (
                  <p>
                    <span className="font-medium text-text">使い方: </span>
                    <span className="text-text-secondary">{asset.usageNote}</span>
                  </p>
                )}
              </div>

              {asset.tags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {asset.tags.map((tag) => (
                    <Badge key={tag} variant="learning">{tag}</Badge>
                  ))}
                </div>
              )}

              <div className="border-t border-border-light pt-4 text-sm">
                {asset.sourceCard ? (
                  <Link
                    href={`/posts/${asset.sourceCard.sourcePostId}/learning`}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    {asset.sourceCard.title}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="text-text-muted">元カードは削除済み</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
