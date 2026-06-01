"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BookOpen,
  FileText,
  Home,
  Layers,
  Link2,
  Menu,
  PenSquare,
  Settings,
  Sparkles,
  Sprout,
  TrendingUp,
  X as XIcon,
  Bookmark,
} from "lucide-react";
import { clsx } from "clsx";

// ボトムタブ = 行為フロー4フェーズ + ホーム（ラベルは具体名で迷わないように）。
const mobileItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/posts/new", label: "追加", icon: PenSquare },
  { href: "/posts", label: "投稿", icon: Archive },
  { href: "/knowhow", label: "メモ", icon: BookOpen },
  { href: "/drafts", label: "下書き", icon: FileText },
];

// ドロワーは Sidebar と同じ「入れる → 理解する → 残す → 出す」グルーピング。
const drawerGroups: {
  title?: string;
  items: { href: string; label: string; icon: typeof Home }[];
}[] = [
  { items: [{ href: "/", label: "ホーム", icon: Home }] },
  {
    title: "入れる",
    items: [{ href: "/posts/new", label: "投稿を追加", icon: PenSquare }],
  },
  {
    title: "理解する",
    items: [
      { href: "/posts", label: "保存した投稿", icon: Archive },
      { href: "/chat", label: "AIに聞く", icon: Sparkles },
    ],
  },
  {
    title: "残す・見返す",
    items: [
      { href: "/knowhow", label: "学びメモ", icon: BookOpen },
      { href: "/collections", label: "コレクション", icon: Layers },
      { href: "/insights", label: "保存傾向", icon: TrendingUp },
    ],
  },
  {
    title: "出す",
    items: [{ href: "/drafts", label: "X下書き", icon: FileText }],
  },
  {
    title: "設定",
    items: [
      { href: "/settings/x", label: "X連携", icon: Link2 },
      { href: "/settings/bookmarklet", label: "ブックマークレット", icon: Bookmark },
      { href: "/settings", label: "設定", icon: Settings },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /posts/new（入れる）は /posts（理解する）の子として扱わない＝二重ハイライト防止。
  if (href === "/posts") {
    return (
      (pathname === "/posts" || pathname.startsWith("/posts/")) &&
      pathname !== "/posts/new"
    );
  }
  // /search は /chat に統合済み。
  if (href === "/chat") {
    return pathname === "/chat" || pathname.startsWith("/chat/") || pathname === "/search";
  }
  return pathname === href || (href !== "/settings" && pathname.startsWith(`${href}/`));
}

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

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
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Sprout className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-bold text-text">SeedThought</span>
          </Link>
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
        </div>
      </nav>

      {/* Slide-in drawer with full menu */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeDrawer}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
              <Link href="/" onClick={closeDrawer} className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                  <Sprout className="h-5 w-5 text-white" />
                </div>
                <span className="text-base font-bold text-text">SeedThought</span>
              </Link>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="メニューを閉じる"
                className="rounded-lg p-1.5 text-text-secondary hover:bg-border-light hover:text-text"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {drawerGroups.map((group, groupIndex) => (
                <div
                  key={group.title ?? `group-${groupIndex}`}
                  className={groupIndex > 0 ? "mt-4" : ""}
                >
                  {group.title && (
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      {group.title}
                    </p>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActivePath(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeDrawer}
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
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
