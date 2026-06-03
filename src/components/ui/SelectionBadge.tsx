"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";

/**
 * 一覧カードの複数選択インジケータ（共通）。
 * 以前は保存投稿カード=右上の丸バッジ、学びメモ=左上の四角アイコン とバラバラだったため、
 * 丸バッジに一本化する。配置（top-right 等）は呼び出し側のラッパーで指定する。
 */
export function SelectionBadge({
  selected,
  className,
}: {
  selected: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition-colors",
        selected ? "border-accent bg-accent" : "border-text-muted bg-white",
        className
      )}
    >
      {selected && <Check className="h-4 w-4 text-white" />}
    </div>
  );
}
