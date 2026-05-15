"use client";

import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <MobileNav />
      <main className="min-w-0 transition-all duration-300 md:ml-[260px]">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6 sm:py-8 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
