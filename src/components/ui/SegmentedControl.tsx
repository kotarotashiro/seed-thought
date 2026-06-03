"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface SegmentedControlItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentedControlItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** sm: text-xs（モード切替など）, md: text-sm（ページ上部のタブ） */
  size?: "sm" | "md";
  /** 各タブを等幅に伸ばす（フォーム内トグルなど） */
  fullWidth?: boolean;
  /** 狭い画面ではラベルを隠してアイコンだけにする */
  collapseLabelsOnMobile?: boolean;
  className?: string;
}

/**
 * アプリ共通のセグメントコントロール。
 * 以前はページごとに rounded-full / rounded-xl・p-1 / p-0.5 がバラバラだったため、
 * 見た目をここに一本化する（外枠: rounded-xl border bg-border-light p-0.5、
 * アクティブ: 白背景 + shadow）。
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  collapseLabelsOnMobile = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={clsx(
        "flex rounded-xl border border-border bg-border-light p-0.5",
        fullWidth ? "w-full" : "w-fit",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
              fullWidth && "flex-1",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
              active
                ? "bg-white text-text shadow-sm"
                : "text-text-secondary hover:text-text"
            )}
          >
            {item.icon}
            <span className={collapseLabelsOnMobile ? "hidden sm:inline" : undefined}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
