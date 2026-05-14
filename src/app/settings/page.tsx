"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Settings, Cpu, User, Save } from "lucide-react";

type ProfileForm = {
  name: string;
  role: string;
  themes: string;
  outputChannels: string;
  tone: string;
};

function listToText(value: string[] | undefined): string {
  return value?.join("、") || "";
}

function textToList(value: string): string[] {
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState("loading");
  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    role: "",
    themes: "",
    outputChannels: "",
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
          themes: listToText(profileData.themes),
          outputChannels: listToText(profileData.outputChannels),
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
          themes: textToList(profile.themes),
          outputChannels: textToList(profile.outputChannels),
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
        themes: listToText(data.themes),
        outputChannels: listToText(data.outputChannels),
        tone: data.tone,
      });
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
            <Textarea
              label="役割"
              value={profile.role}
              onChange={(e) => setProfile((current) => ({ ...current, role: e.target.value }))}
              rows={3}
            />
            <Textarea
              label="テーマ（読点・カンマ・改行で区切り）"
              value={profile.themes}
              onChange={(e) => setProfile((current) => ({ ...current, themes: e.target.value }))}
              rows={3}
            />
            <Textarea
              label="出力先（読点・カンマ・改行で区切り）"
              value={profile.outputChannels}
              onChange={(e) => setProfile((current) => ({ ...current, outputChannels: e.target.value }))}
              rows={2}
            />
            <Textarea
              label="トーン"
              value={profile.tone}
              onChange={(e) => setProfile((current) => ({ ...current, tone: e.target.value }))}
              rows={3}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
