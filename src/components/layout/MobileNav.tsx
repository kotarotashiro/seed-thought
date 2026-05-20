"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, BookOpen, Home, MessageCircle, Search, Settings, Sprout } from "lucide-react";
import { clsx } from "clsx";

const mobileItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/posts", label: "保存", icon: Archive },
  { href: "/knowhow", label: "カード", icon: BookOpen },
  { href: "/search", label: "検索", icon: Search },
  { href: "/chat", label: "チャット", icon: MessageCircle },
  { href: "/settings", label: "設定", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || (href !== "/settings" && pathname.startsWith(`${href}/`));
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Sprout className="h-5 w-5 text-white" />
          </div>
          <span className="text-base font-bold text-text">SeedThought</span>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-6 gap-1">
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
    </>
  );
}
