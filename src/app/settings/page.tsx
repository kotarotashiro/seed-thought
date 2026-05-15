"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Settings, Cpu, User, Save } from "lucide-react";

type ProfileForm = {
  name: string;
  role: string;
  themes: string[];
  outputChannels: string[];
  tone: string;
};

const roleOptions = [
  "AI活用・SNS運用・LINE導線設計を発信する個人クリエイター",
  "AI活用を発信する個人クリエイター",
  "SNS運用・マーケティング支援者",
  "LINE導線設計・店舗集客支援者",
  "セミナー講師・コンテンツ制作者",
];

const themeOptions = [
  "AI活用",
  "Instagram",
  "公式LINE",
  "X運用",
  "note",
  "チラシ",
  "セミナー",
  "マーケティング",
  "導線設計",
  "業務効率化",
];

const outputChannelOptions = ["X", "Instagram", "note", "ブログ", "セミナー資料", "チラシ"];

const toneOptions = [
  "やさしく、実用的で、少し本音感のある文章",
  "短く、わかりやすく、行動につながる文章",
  "専門的だが、初心者にも伝わる文章",
  "熱量があり、背中を押す文章",
  "落ち着いていて、信頼感のある文章",
];

function toggleListValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState("loading");
  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    role: "",
    themes: [],
    outputChannels: [],
    tone: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [statusRes, profileRes] = await Promise.all([
          fetch("/api/settings/status"),
          fetch("/api/settings/profile"),
        ]);
        const statusData = await statusRes.json();
        const profileData = await profileRes.json();
        if (cancelled) return;

        setAiProvider(statusData.aiProvider || "mock");
        setProfile({
          name: profileData.name || "",
          role: profileData.role || "",
          themes: profileData.themes || [],
          outputChannels: profileData.outputChannels || [],
          tone: profileData.tone || "",
        });
      } catch {
        if (!cancelled) setError("設定の読み込みに失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          role: profile.role,
          themes: profile.themes,
          outputChannels: profile.outputChannels,
          tone: profile.tone,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "保存に失敗しました");
        return;
      }

      setProfile({
        name: data.name,
        role: data.role,
        themes: data.themes || [],
        outputChannels: data.outputChannels || [],
        tone: data.tone,
      });
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: data }));
      setMessage("プロフィール設定を保存しました。次回のAI分類・深掘り・アウトプット生成から反映されます。");
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <Settings className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">設定</h1>
          <p className="text-sm text-text-secondary">
            アプリケーションの設定を編集
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-success/20 bg-success-light px-4 py-3 text-sm text-success">
          {message}
        </div>
      )}

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
            AI ProviderはVercel環境変数またはローカル.envの AI_PROVIDER で切り替えます。
          </p>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-text">プロフィール</h3>
          </div>
          <Button size="sm" onClick={handleSave} disabled={loading || saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-12 bg-border-light rounded-xl" />
            <div className="h-24 bg-border-light rounded-xl" />
            <div className="h-12 bg-border-light rounded-xl" />
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-text mb-1">名前</span>
              <input
                value={profile.name}
                onChange={(e) => setProfile((current) => ({ ...current, name: e.target.value }))}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-accent"
              />
            </label>
            <Select
              label="役割"
              value={profile.role}
              onChange={(e) => setProfile((current) => ({ ...current, role: e.target.value }))}
              options={roleOptions.map((value) => ({ value, label: value }))}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-text">テーマ</p>
              <div className="grid grid-cols-2 gap-2">
                {themeOptions.map((theme) => (
                  <label
                    key={theme}
                    className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-text"
                  >
                    <input
                      type="checkbox"
                      checked={profile.themes.includes(theme)}
                      onChange={() =>
                        setProfile((current) => ({
                          ...current,
                          themes: toggleListValue(current.themes, theme),
                        }))
                      }
                      className="h-4 w-4 accent-accent"
                    />
                    {theme}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-text">出力先</p>
              <div className="grid grid-cols-2 gap-2">
                {outputChannelOptions.map((channel) => (
                  <label
                    key={channel}
                    className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-text"
                  >
                    <input
                      type="checkbox"
                      checked={profile.outputChannels.includes(channel)}
                      onChange={() =>
                        setProfile((current) => ({
                          ...current,
                          outputChannels: toggleListValue(current.outputChannels, channel),
                        }))
                      }
                      className="h-4 w-4 accent-accent"
                    />
                    {channel}
                  </label>
                ))}
              </div>
            </div>
            <Select
              label="トーン"
              value={profile.tone}
              onChange={(e) => setProfile((current) => ({ ...current, tone: e.target.value }))}
              options={toneOptions.map((value) => ({ value, label: value }))}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
