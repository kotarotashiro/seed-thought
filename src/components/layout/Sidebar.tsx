"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Archive,
  PenSquare,
  Link2,
  Settings,
  ChevronLeft,
  Sprout,
  BookOpen,
  Sparkles,
  TrendingUp,
  Layers,
  FileText,
  Bookmark,
} from "lucide-react";
import { clsx } from "clsx";

// 「入れる → 理解する → 残す → 出す」の行為フローでグルーピングする。
// title なしのグループは見出しを出さない（ホーム / 設定）。
const navGroups: {
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
  // /search は /chat に統合済み。/search にいる間も AIに聞く をハイライト。
  if (href === "/chat") {
    return pathname === "/chat" || pathname.startsWith("/chat/") || pathname === "/search";
  }
  return pathname === href || (href !== "/settings" && pathname.startsWith(`${href}/`));
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const [profile, setProfile] = useState({
    name: "そら",
    role: "個人クリエイター",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch("/api/settings/profile");
        const data = await res.json();
        if (!cancelled) {
          setProfile({
            name: data.name || "そら",
            role: data.role || "個人クリエイター",
          });
        }
      } catch {
        // Keep default profile in the sidebar.
      }
    }

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; role?: string }>).detail;
      if (detail) {
        setProfile((current) => ({
          name: detail.name || current.name,
          role: detail.role || current.role,
        }));
      } else {
        loadProfile();
      }
    };

    loadProfile();
    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  const profileInitial = profile.name.trim().charAt(0) || "そ";

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-border bg-white transition-all duration-300 md:flex",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-5 py-5 border-b border-border-light hover:bg-border-light/50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Sprout className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight text-text">
            SeedThought
          </span>
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {navGroups.map((group, groupIndex) => (
          <div
            key={group.title ?? `group-${groupIndex}`}
            className={groupIndex > 0 ? "mt-4" : ""}
          >
            {group.title && !collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {group.title}
              </p>
            )}
            {group.title && collapsed && groupIndex > 0 && (
              <div className="mx-3 mb-2 border-t border-border-light" />
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                      isActive
                        ? "bg-border-light text-text font-semibold"
                        : "font-medium text-text-secondary hover:bg-border-light hover:text-text"
                    )}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div className="border-t border-border-light px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-light flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-accent">{profileInitial}</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">
                {profile.name}
              </p>
              <p className="text-xs text-text-muted truncate">{profile.role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-border shadow-sm flex items-center justify-center hover:bg-border-light transition-colors"
      >
        <ChevronLeft
          className={clsx(
            "w-3.5 h-3.5 text-text-secondary transition-transform",
            collapsed && "rotate-180"
          )}
        />
      </button>
    </aside>
  );
}
