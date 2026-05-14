import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "SeedThought - 保存した投稿を深掘りして自分の知識に変える",
  description:
    "Xでいいね・ブックマークした投稿を1つずつ深掘りし、自分の学び・思考・発信素材に変えるWebアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
