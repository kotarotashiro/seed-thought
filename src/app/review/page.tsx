"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Loader2,
  Sparkles,
  Volume2,
  X as XIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface ReviewCard {
  id: string;
  title: string;
  summary: string;
  coreInsight: string;
  manual: string;
  reviewLevel: number;
  lastReviewedAt: string | null;
  nextDueAt: string | null;
  userMemo: string | null;
  sourcePost: {
    id: string;
    text: string;
    sourceUrl: string | null;
    authorUsername: string | null;
    classification: {
      primaryCategory: string;
      summary: string;
    } | null;
  };
}

type ReviewResult = "again" | "good" | "easy";

const RESULT_LABELS: Record<ReviewResult, { label: string; desc: string; tone: string }> = {
  again: { label: "もう一度", desc: "明日もう一度復習", tone: "border-danger/40 text-danger hover:bg-danger/5" },
  good: { label: "OK", desc: "間隔を伸ばす", tone: "border-accent/40 text-accent hover:bg-accent/5" },
  easy: { label: "簡単", desc: "大幅に伸ばす", tone: "border-emerald-400/50 text-emerald-700 hover:bg-emerald-50" },
};

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const playCardAudio = (card: { title: string; summary: string; coreInsight: string }) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("このブラウザは音声合成に対応していません");
      return;
    }
    if (audioPlaying) {
      window.speechSynthesis.cancel();
      setAudioPlaying(false);
      return;
    }
    const text = `${card.title}。${card.summary}。核心: ${card.coreInsight}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 1.0;
    utterance.onend = () => setAudioPlaying(false);
    utterance.onerror = () => setAudioPlaying(false);
    setAudioPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const current = cards[index];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/review");
        const data = await res.json();
        if (cancelled) return;
        setCards(data.cards || []);
        setUpcomingCount(data.upcomingCount || 0);
      } catch (error) {
        console.error("Failed to fetch review queue:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResult = async (result: ReviewResult) => {
    if (!current || reviewing) return;
    setReviewing(true);
    try {
      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: current.id, result }),
      });
      setReviewedCount((c) => c + 1);
      setRevealed(false);
      setShowManual(false);
      setIndex((i) => i + 1);
    } catch (error) {
      console.error("Failed to record review:", error);
      alert("復習の記録に失敗しました");
    } finally {
      setReviewing(false);
    }
  };

  const progress = useMemo(
    () => (cards.length === 0 ? 0 : Math.round((reviewedCount / cards.length) * 100)),
    [cards.length, reviewedCount]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-text-secondary">
        <span className="animate-pulse">復習キューを読み込み中…</span>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-6">
        <Header reviewedCount={0} total={0} upcomingCount={upcomingCount} progress={0} />
        <Card className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light">
            <CheckCircle2 className="h-7 w-7 text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text">今日の復習は完了です 🎉</h2>
          <p className="mt-2 text-sm text-text-secondary">
            あと {upcomingCount} 件の保存カードが将来の予定に入っています。
          </p>
          <Link href="/knowhow" className="mt-6 inline-block">
            <Button variant="secondary" size="sm">
              <BookOpen className="mr-2 h-4 w-4" />
              学びメモ一覧へ
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (index >= cards.length) {
    return (
      <div className="space-y-6">
        <Header
          reviewedCount={reviewedCount}
          total={cards.length}
          upcomingCount={upcomingCount}
          progress={100}
        />
        <Card className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light">
            <Sparkles className="h-7 w-7 text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text">本日のセッション完了！</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {reviewedCount} 件のカードを復習しました。明日もこの調子で。
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/">
              <Button variant="secondary" size="sm">ホームへ</Button>
            </Link>
            <Link href="/knowhow">
              <Button size="sm">学びメモ一覧</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header
        reviewedCount={reviewedCount}
        total={cards.length}
        upcomingCount={upcomingCount}
        progress={progress}
      />

      <Card padding="lg" className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {current.sourcePost.classification?.primaryCategory && (
              <Badge>{current.sourcePost.classification.primaryCategory}</Badge>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-border-light px-2 py-0.5 text-xs text-text-secondary">
              <Flame className="h-3 w-3" />
              Lv {current.reviewLevel}
            </span>
            {current.lastReviewedAt && (
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <Clock className="h-3 w-3" />
                前回: {new Date(current.lastReviewedAt).toLocaleDateString("ja-JP")}
              </span>
            )}
          </div>
          <span className="text-xs text-text-muted">
            {index + 1} / {cards.length}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold text-text sm:text-xl">{current.title}</h1>
          <button
            type="button"
            title="音声で聞く"
            onClick={() => playCardAudio(current)}
            className={`flex-shrink-0 rounded-lg p-2 transition-colors ${audioPlaying ? "bg-accent text-white" : "bg-border-light text-text-secondary hover:text-accent"}`}
          >
            {audioPlaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Question side: summary */}
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            要約
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
            {current.summary}
          </p>
        </div>

        {!revealed ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <p className="text-sm text-text-secondary">
              この投稿の <strong className="text-text">核心</strong>と<strong className="text-text">実践マニュアル</strong>を思い出してから「答えを見る」を押してください。
            </p>
            <Button onClick={() => setRevealed(true)} size="md">
              <ArrowRight className="mr-2 h-4 w-4" />
              答えを見る
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-accent/30 bg-accent-light/40 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
                核心
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                {current.coreInsight}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-sm text-text-secondary hover:bg-border-light"
            >
              <span className="font-semibold">マニュアルを見る</span>
              {showManual ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showManual && (
              <div className="rounded-2xl border border-border bg-white p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                  {current.manual}
                </p>
              </div>
            )}

            {current.userMemo && (
              <div className="rounded-2xl border border-border bg-white p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  あなたのメモ
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {current.userMemo}
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {(["again", "good", "easy"] as const).map((r) => {
                const meta = RESULT_LABELS[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleResult(r)}
                    disabled={reviewing}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-white px-3 py-3 text-sm font-semibold transition-all disabled:opacity-50 ${meta.tone}`}
                  >
                    <span>{meta.label}</span>
                    <span className="text-[10px] font-normal text-text-muted">{meta.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-text-muted">
              <Link
                href={`/posts/${current.sourcePost.id}/learning`}
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                学習カードを開く
                <ArrowRight className="h-3 w-3" />
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-text"
                onClick={() => {
                  setRevealed(false);
                  setShowManual(false);
                  setIndex((i) => i + 1);
                }}
              >
                スキップ
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Header({
  reviewedCount,
  total,
  upcomingCount,
  progress,
}: {
  reviewedCount: number;
  total: number;
  upcomingCount: number;
  progress: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
          <Flame className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text sm:text-2xl">今日の復習</h1>
          <p className="mt-1 text-xs text-text-secondary">
            {total > 0 ? `本日 ${total} 件、` : "今日の予定なし、"}
            将来 {upcomingCount} 件が予定済み
          </p>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border-light">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {total > 0 && (
        <p className="mt-2 text-xs text-text-muted">
          {reviewedCount} / {total} 完了
        </p>
      )}
    </div>
  );
}
