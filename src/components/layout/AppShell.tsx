"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { DialogProvider } from "@/components/ui/DialogProvider";
import { ConnectionBanner, type GrokStatus } from "./ConnectionBanner";

/** 起動時に1回だけ heartbeat を叩き、次の focus 契機まで最低この ms を空ける */
const FOCUS_THROTTLE_MS = 3 * 60 * 1000; // 3分

interface HeartbeatResponse {
  grok: GrokStatus;
  x: { connected: boolean; lastSyncAt: string | null };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [grokStatus, setGrokStatus] = useState<GrokStatus | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchHeartbeat = async () => {
    try {
      const res = await fetch("/api/app/heartbeat");
      if (!res.ok) return;
      const data = (await res.json()) as HeartbeatResponse;
      setGrokStatus(data.grok);
      lastFetchRef.current = Date.now();
    } catch {
      // ネットワークエラー等は無視
    }
  };

  useEffect(() => {
    // マウント時に1回実行
    void fetchHeartbeat();

    // ウィンドウフォーカス時にスロットル付きで再取得
    const onFocus = () => {
      if (Date.now() - lastFetchRef.current >= FOCUS_THROTTLE_MS) {
        void fetchHeartbeat();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DialogProvider>
      <div className="min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <MobileNav />
        <main
          className={clsx(
            "min-w-0 transition-all duration-300",
            collapsed ? "md:ml-[68px]" : "md:ml-[260px]"
          )}
        >
          <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6 sm:py-8 md:px-8">
            {grokStatus && (
              <div className="mb-4">
                <ConnectionBanner grok={grokStatus} />
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </DialogProvider>
  );
}
