"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle } from "lucide-react";

export interface GrokStatus {
  connected: boolean;
  fallbackActive: boolean;
}

interface ConnectionBannerProps {
  grok: GrokStatus | null;
}

export function ConnectionBanner({ grok }: ConnectionBannerProps) {
  if (!grok) return null;

  // 完全切断（OAuth切れ & APIキーなし）
  if (!grok.connected && !grok.fallbackActive) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">
          Grok連携が切れています。AIによる生成・学習カード作成が使えません。
        </span>
        <Link
          href="/settings/x"
          className="flex-shrink-0 font-medium underline underline-offset-2 hover:opacity-70"
        >
          再接続
        </Link>
      </div>
    );
  }

  // フォールバック稼働中（APIキーで代替）
  if (grok.fallbackActive) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">
          Grok OAuth接続が切れています。APIキーで代替稼働中です。
        </span>
        <Link
          href="/settings/x"
          className="flex-shrink-0 font-medium underline underline-offset-2 hover:opacity-70"
        >
          再接続
        </Link>
      </div>
    );
  }

  // 接続中 → 何も表示しない
  return null;
}
