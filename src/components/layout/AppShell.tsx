"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { DialogProvider } from "@/components/ui/DialogProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

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
            {children}
          </div>
        </main>
      </div>
    </DialogProvider>
  );
}
