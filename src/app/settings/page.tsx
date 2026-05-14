"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Settings, Cpu, User } from "lucide-react";

export default function SettingsPage() {
  const aiProvider = process.env.NEXT_PUBLIC_AI_PROVIDER || "mock";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <Settings className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">設定</h1>
          <p className="text-sm text-text-secondary">
            アプリケーションの設定を確認
          </p>
        </div>
      </div>

      {/* AI Provider */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Cpu className="w-5 h-5 text-accent" />
          <h3 className="text-base font-bold text-text">AI Provider</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-border-light rounded-xl px-4 py-3">
            <span className="text-sm text-text">現在のProvider</span>
            <Badge variant="success">{aiProvider}</Badge>
          </div>
          <p className="text-xs text-text-muted">
            AI Providerは.envファイルの AI_PROVIDER で切り替えできます。
            <br />
            選択肢: mock / openai / gemini
          </p>
        </div>
      </Card>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-accent" />
          <h3 className="text-base font-bold text-text">固定プロフィール</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-border-light rounded-xl px-4 py-3">
            <span className="text-sm text-text-secondary">名前</span>
            <span className="text-sm text-text font-medium">そら</span>
          </div>
          <div className="flex items-center justify-between bg-border-light rounded-xl px-4 py-3">
            <span className="text-sm text-text-secondary">役割</span>
            <span className="text-sm text-text font-medium text-right max-w-[300px]">
              AI活用・SNS運用・LINE導線設計を発信する個人クリエイター
            </span>
          </div>
          <div className="flex items-center justify-between bg-border-light rounded-xl px-4 py-3">
            <span className="text-sm text-text-secondary">テーマ</span>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {["AI活用", "Instagram", "公式LINE", "チラシ", "セミナー", "マーケティング"].map(
                (theme) => (
                  <Badge key={theme}>{theme}</Badge>
                )
              )}
            </div>
          </div>
          <div className="flex items-center justify-between bg-border-light rounded-xl px-4 py-3">
            <span className="text-sm text-text-secondary">出力先</span>
            <div className="flex gap-1.5">
              {["X", "Instagram", "note"].map((ch) => (
                <Badge key={ch} variant="success">{ch}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between bg-border-light rounded-xl px-4 py-3">
            <span className="text-sm text-text-secondary">トーン</span>
            <span className="text-sm text-text font-medium">
              やさしく、実用的で、少し本音感のある文章
            </span>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-3">
          ※ Phase 2で編集機能を追加予定
        </p>
      </Card>
    </div>
  );
}
