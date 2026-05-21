"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BookOpen,
  Home,
  Link2,
  Menu,
  PenSquare,
  Search,
  Settings,
  Sprout,
  TrendingUp,
  X as XIcon,
} from "lucide-react";
import { clsx } from "clsx";

const mobileItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/posts", label: "保存", icon: Archive },
  { href: "/knowhow", label: "カード", icon: BookOpen },
  { href: "/search", label: "検索", icon: Search },
];

const drawerItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/posts", label: "保存一覧", icon: Archive },
  { href: "/knowhow", label: "学習カード一覧", icon: BookOpen },
  { href: "/search", label: "ノウハウ検索", icon: Search },
  { href: "/insights", label: "いいね傾向分析", icon: TrendingUp },
  { href: "/posts/new", label: "投稿を追加", icon: PenSquare },
  { href: "/settings/x", label: "X連携", icon: Link2 },
  { href: "/settings", label: "設定", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || (href !== "/settings" && pathname.startsWith(`${href}/`));
}

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open.
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Sprout className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-bold text-text">SeedThought</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="メニューを開く"
            className="rounded-lg p-1.5 text-text-secondary hover:bg-border-light hover:text-text"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Bottom tab bar — 4 primary destinations + "メニュー" for everything else */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
                  active
                    ? "bg-accent-light text-accent"
                    : "text-text-secondary hover:bg-border-light hover:text-text"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={clsx(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
              "text-text-secondary hover:bg-border-light hover:text-text"
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="truncate">メニュー</span>
          </button>
        </div>
      </nav>

      {/* Slide-in drawer with full menu */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                  <Sprout className="h-5 w-5 text-white" />
                </div>
                <span className="text-base font-bold text-text">SeedThought</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="メニューを閉じる"
                className="rounded-lg p-1.5 text-text-secondary hover:bg-border-light hover:text-text"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {drawerItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent-light text-accent"
                        : "text-text-secondary hover:bg-border-light hover:text-text"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
