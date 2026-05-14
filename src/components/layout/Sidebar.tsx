"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Archive,
  PenSquare,
  Layers,
  FileText,
  Link2,
  Settings,
  ChevronLeft,
  Sprout,
} from "lucide-react";
import { clsx } from "clsx";

const menuItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/posts", label: "保存一覧", icon: Archive },
  { href: "/posts/new", label: "投稿を追加", icon: PenSquare },
  { href: "/deep-dives", label: "深掘り履歴", icon: Layers },
  { href: "/notes", label: "要点まとめ", icon: FileText },
  { href: "/settings/x", label: "X連携", icon: Link2 },
  { href: "/settings", label: "設定", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-screen bg-white border-r border-border flex flex-col z-40 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border-light">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Sprout className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight text-text">
            SeedThought
          </span>
        )}
      </div>

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
            <span className="text-sm font-bold text-accent">そ</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">
                そら｜ライター
              </p>
              <p className="text-xs text-text-muted truncate">個人クリエイター</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
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
