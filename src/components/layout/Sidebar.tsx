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
  Search,
  TrendingUp,
  Layers,
  MessageSquare,
  FileText,
  Bookmark,
} from "lucide-react";
import { clsx } from "clsx";

const menuItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/posts", label: "保存した投稿", icon: Archive },
  { href: "/knowhow", label: "学びメモ", icon: BookOpen },
  { href: "/collections", label: "コレクション", icon: Layers },
  { href: "/search", label: "メモを検索", icon: Search },
  { href: "/chat", label: "投稿に質問", icon: MessageSquare },
  { href: "/insights", label: "保存傾向", icon: TrendingUp },
  { href: "/drafts", label: "X下書き", icon: FileText },
  { href: "/posts/new", label: "投稿を追加", icon: PenSquare },
  { href: "/settings/x", label: "X連携", icon: Link2 },
  { href: "/settings/bookmarklet", label: "ブックマークレット", icon: Bookmark },
  { href: "/settings", label: "設定", icon: Settings },
];

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
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-accent-light text-accent"
                  : "text-text-secondary hover:bg-border-light hover:text-text"
              )}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
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
