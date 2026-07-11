"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface SynthesisMaterialView {
  kind: "card" | "pattern";
  title: string;
  href: string | null;
}

interface SynthesisSuggestionView {
  id: string;
  status: "proposed" | "accepted" | "dismissed";
  title: string;
  angle: string;
  reason: string;
  takeaway: string;
  seedHook: string | null;
  collectionId: string | null;
  materials: SynthesisMaterialView[];
}

interface TodaySynthesisResponse {
  suggestion: SynthesisSuggestionView | null;
  reason?: string;
  remainingRegenerations: number;
}

function SynthesisSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5 sm:p-6 animate-pulse">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-border-light" />
        <div className="h-4 w-36 rounded bg-border-light" />
      </div>
      <div className="mb-4 flex gap-2">
        <div className="h-6 w-24 rounded-full bg-border-light" />
        <div className="h-6 w-28 rounded-full bg-border-light" />
      </div>
      <div className="space-y-2">
        <div className="h-4 rounded bg-border-light" />
        <div className="h-4 w-5/6 rounded bg-border-light" />
        <div className="h-4 w-2/3 rounded bg-border-light" />
      </div>
    </div>
  );
}

function MaterialChip({ material }: { material: SynthesisMaterialView }) {
  const body = (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-border-light px-2.5 py-1 text-xs font-medium text-text-secondary">
      {material.kind === "pattern" && <Badge size="sm">型</Badge>}
      <span className="truncate">{material.title}</span>
    </span>
  );
  if (!material.href) return body;
  return (
    <Link href={material.href} className="max-w-full hover:opacity-80">
      {body}
    </Link>
  );
}

export function TodaySynthesisCard() {
  const router = useRouter();
  const [suggestion, setSuggestion] = useState<SynthesisSuggestionView | null>(null);
  const [remainingRegenerations, setRemainingRegenerations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyAction, setBusyAction] = useState<"accept" | "regenerate" | "dismiss" | null>(null);

  async function loadToday(showLoading = true) {
    if (showLoading) setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/synthesis/today");
      if (!res.ok) throw new Error("synthesis failed");
      const data = (await res.json()) as TodaySynthesisResponse;
      setSuggestion(data.suggestion);
      setRemainingRegenerations(data.remainingRegenerations ?? 0);
    } catch {
      setError(true);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadToday();
  }, []);

  async function accept() {
    if (!suggestion) return;
    setBusyAction("accept");
    try {
      const res = await fetch(`/api/synthesis/${suggestion.id}/accept`, { method: "POST" });
      if (!res.ok) throw new Error("accept failed");
      const data = (await res.json()) as { collectionId: string };
      router.push(`/collections/${data.collectionId}`);
    } catch {
      setError(true);
    } finally {
      setBusyAction(null);
    }
  }

  async function regenerate() {
    setBusyAction("regenerate");
    setError(false);
    try {
      const res = await fetch("/api/synthesis/today/regenerate", { method: "POST" });
      if (!res.ok) throw new Error("regenerate failed");
      const data = (await res.json()) as TodaySynthesisResponse;
      setSuggestion(data.suggestion);
      setRemainingRegenerations(data.remainingRegenerations ?? 0);
    } catch {
      setError(true);
    } finally {
      setBusyAction(null);
    }
  }

  async function dismiss() {
    if (!suggestion) return;
    setBusyAction("dismiss");
    try {
      const res = await fetch(`/api/synthesis/${suggestion.id}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error("dismiss failed");
      setSuggestion({ ...suggestion, status: "dismissed" });
    } catch {
      setError(true);
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) return <SynthesisSkeleton />;
  if (!suggestion && !error) return null;

  if (error) {
    return (
      <Card className="py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-text">生成に失敗しました</h2>
            <p className="mt-1 text-sm text-text-secondary">時間をおいて再試行してください。</p>
          </div>
          <Button variant="secondary" onClick={() => loadToday()} loading={loading}>
            再試行
          </Button>
        </div>
      </Card>
    );
  }

  if (!suggestion) return null;

  if (suggestion.status === "accepted") {
    return (
      <Card className="py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold text-accent">今日の掛け合わせ</p>
            <h2 className="font-semibold text-text">{suggestion.title}</h2>
          </div>
          {suggestion.collectionId && (
            <Link
              href={`/collections/${suggestion.collectionId}`}
              className="inline-flex items-center text-sm font-medium text-accent hover:underline"
            >
              コレクションで発信をつくる
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          )}
        </div>
      </Card>
    );
  }

  if (suggestion.status === "dismissed") {
    return (
      <Card className="py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold text-text-muted">今日の掛け合わせ</p>
            <h2 className="font-semibold text-text">今日はスキップしました</h2>
          </div>
          {remainingRegenerations > 0 && (
            <Button
              variant="secondary"
              onClick={regenerate}
              loading={busyAction === "regenerate"}
            >
              別の掛け合わせを見る
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 sm:p-6">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-light">
          <Sparkles className="h-[18px] w-[18px] text-accent" />
        </div>
        <div>
          <p className="text-xs font-semibold text-accent">今日の掛け合わせ</p>
          <p className="text-xs text-text-muted">保存した素材から発信ネタの種を1つ</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestion.materials.map((material, index) => (
          <MaterialChip key={`${material.kind}-${material.title}-${index}`} material={material} />
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold leading-snug text-text">{suggestion.title}</h2>
        <p className="text-sm leading-relaxed text-text-secondary">{suggestion.angle}</p>
        <p className="text-sm leading-relaxed text-text-secondary">{suggestion.reason}</p>
        <p className="text-sm leading-relaxed text-text">
          <span className="font-semibold">持ち帰り: </span>
          {suggestion.takeaway}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          variant="primary"
          onClick={accept}
          loading={busyAction === "accept"}
          className="sm:flex-shrink-0"
        >
          この掛け合わせでつくる
        </Button>
        {remainingRegenerations > 0 && (
          <Button
            variant="ghost"
            onClick={regenerate}
            loading={busyAction === "regenerate"}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            別の掛け合わせ
            <span className="ml-1 text-xs text-text-muted">残り{remainingRegenerations}回</span>
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={dismiss}
          loading={busyAction === "dismiss"}
          className="sm:ml-auto"
        >
          今日はスキップ
        </Button>
      </div>
    </Card>
  );
}
