"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CollectionSuggestion } from "@/app/api/collections/suggestions/route";

/** localStorage に「あとで」を保存するキー。キーはカテゴリ名ベース */
const DISMISSED_KEY = "collection_suggestions_dismissed";
/** 14日（ms）非表示にする */
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function getDismissed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveDismissed(key: string) {
  const existing = getDismissed();
  existing[key] = Date.now();
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(existing));
}

function isCurrentlyDismissed(key: string): boolean {
  const dismissed = getDismissed();
  const ts = dismissed[key];
  return Boolean(ts && Date.now() - ts < DISMISS_TTL_MS);
}

export function CollectionSuggestions() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<CollectionSuggestion[]>([]);
  const [visible, setVisible] = useState<CollectionSuggestion[]>([]);

  useEffect(() => {
    fetch("/api/collections/suggestions")
      .then((r) => r.json())
      .then((data: { suggestions?: CollectionSuggestion[] }) => {
        const all = data.suggestions ?? [];
        setSuggestions(all);
        setVisible(all.filter((s) => !isCurrentlyDismissed(s.key)));
      })
      .catch(() => {
        // 取得失敗は無視
      });
  }, []);

  if (visible.length === 0) return null;

  const handleCreate = (s: CollectionSuggestion) => {
    const params = s.cardIds.map((id) => `cardId=${id}`).join("&");
    router.push(`/collections?${params}`);
  };

  const handleDismiss = (key: string) => {
    saveDismissed(key);
    setVisible((prev) => prev.filter((s) => s.key !== key));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <p className="text-sm font-semibold text-text">コレクションおすすめ</p>
      </div>
      {visible.map((s) => (
        <div
          key={s.key}
          className="flex items-start gap-3 rounded-xl border border-accent/20 bg-accent-subtle p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">
              {s.label}の学びが{s.count}枚たまっています。コレクションにまとめませんか？
            </p>
            {s.sampleTitles.length > 0 && (
              <p className="mt-1 truncate text-xs text-text-muted">
                {s.sampleTitles.join("、")} など
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleCreate(s)}
            >
              作る
            </Button>
            <button
              type="button"
              onClick={() => handleDismiss(s.key)}
              className="p-1 text-text-muted hover:text-text"
              aria-label="あとで"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
