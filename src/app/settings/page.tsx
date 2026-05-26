"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Database,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  User,
} from "lucide-react";

type ProfileForm = {
  name: string;
  role: string;
  themes: string[];
  outputChannels: string[];
  tone: string;
  knowledge: string;
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

function SectionHeader({
  open,
  onToggle,
  icon,
  title,
  badge,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 text-left"
    >
      {icon}
      <span className="flex-1 text-base font-bold text-text">{title}</span>
      {badge}
      <ChevronDown
        className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    notion: false,
    profile: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    role: "",
    themes: [],
    outputChannels: [],
    tone: "",
    knowledge: "",
  });
  const [notionApiKey, setNotionApiKey] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [notionHasApiKey, setNotionHasApiKey] = useState(false);
  const [savingNotion, setSavingNotion] = useState(false);
  const [syncingNotion, setSyncingNotion] = useState(false);
  const [notionMessage, setNotionMessage] = useState<string | null>(null);
  const [notionError, setNotionError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [profileRes, notionRes] = await Promise.all([
          fetch("/api/settings/profile"),
          fetch("/api/notion/settings"),
        ]);
        const profileData = await profileRes.json();
        const notionData = await notionRes.json();
        if (cancelled) return;

        setProfile({
          name: profileData.name || "",
          role: profileData.role || "",
          themes: profileData.themes || [],
          outputChannels: profileData.outputChannels || [],
          tone: profileData.tone || "",
          knowledge: profileData.knowledge || "",
        });
        setNotionHasApiKey(Boolean(notionData.hasApiKey));
        setNotionDatabaseId(notionData.databaseId || "");
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
          knowledge: profile.knowledge,
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
        knowledge: data.knowledge || "",
      });
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: data }));
      setMessage("プロフィール設定を保存しました。次回のAI分類・深掘り・アウトプット生成から反映されます。");
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotion = async () => {
    setSavingNotion(true);
    setNotionError(null);
    setNotionMessage(null);
    try {
      const res = await fetch("/api/notion/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: notionApiKey || undefined,
          databaseId: notionDatabaseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotionError(data.error || "保存に失敗しました");
        return;
      }
      setNotionHasApiKey(Boolean(data.hasApiKey));
      setNotionApiKey("");
      setNotionMessage("Notion設定を保存しました");
    } catch {
      setNotionError("Notion設定の保存に失敗しました");
    } finally {
      setSavingNotion(false);
    }
  };

  const handleSyncNotion = async () => {
    setSyncingNotion(true);
    setNotionError(null);
    setNotionMessage(null);
    try {
      const res = await fetch("/api/notion/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setNotionError(data.error || "同期に失敗しました");
        return;
      }
      setNotionMessage(
        `同期完了: ${data.synced}件を新規追加、${data.skipped}件はスキップ${data.errors?.length ? `（${data.errors.length}件エラー）` : ""}`
      );
    } catch {
      setNotionError("Notion同期に失敗しました");
    } finally {
      setSyncingNotion(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3 sm:items-center">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <Settings className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text sm:text-2xl">設定</h1>
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

      {/* Notion Integration */}
      <Card>
        <SectionHeader
          open={openSections.notion}
          onToggle={() => toggleSection("notion")}
          icon={<Database className="w-5 h-5 text-accent flex-shrink-0" />}
          title="Notion連携"
          badge={
            <Badge variant={notionHasApiKey ? "success" : "warning"}>
              {notionHasApiKey ? "APIキー設定済み" : "未設定"}
            </Badge>
          }
        />
        {openSections.notion && (
          <div className="mt-4 space-y-4">
            {notionError && (
              <div className="rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {notionError}
              </div>
            )}
            {notionMessage && (
              <div className="rounded-xl border border-success/20 bg-success-light px-4 py-3 text-sm text-success flex gap-2 items-start">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {notionMessage}
              </div>
            )}

            <p className="text-xs text-text-secondary">
              保存済みの学びメモをNotionデータベースに同期します。<br />
              Notionでインテグレーションを作成し、データベースと共有してください。
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">
                Notion APIキー（Internal Integration Token）
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={notionApiKey}
                  onChange={(e) => setNotionApiKey(e.target.value)}
                  placeholder={notionHasApiKey ? "（設定済み・変更する場合のみ入力）" : "secret_..."}
                  className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">
                データベースID
              </label>
              <input
                type="text"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text outline-none focus:border-accent"
              />
              <p className="text-xs text-text-muted">
                NotionのデータベースURLの末尾32文字
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSaveNotion}
                disabled={savingNotion}
                size="sm"
              >
                {savingNotion ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                設定を保存
              </Button>
              <Button
                variant="secondary"
                onClick={handleSyncNotion}
                disabled={syncingNotion || !notionHasApiKey || !notionDatabaseId}
                size="sm"
              >
                {syncingNotion ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                Notionに同期
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Profile */}
      <Card>
        <SectionHeader
          open={openSections.profile}
          onToggle={() => toggleSection("profile")}
          icon={<User className="w-5 h-5 text-accent flex-shrink-0" />}
          title="プロフィール"
        />
        {openSections.profile && (
          <div className="mt-4">
            <div className="mb-4 flex justify-end">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={loading || saving}
                loading={saving}
                loadingLabel="保存中..."
                className="w-full sm:w-auto"
              >
                <Save className="w-4 h-4 mr-1" />
                保存
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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                <Select
                  label="トーン"
                  value={profile.tone}
                  onChange={(e) => setProfile((current) => ({ ...current, tone: e.target.value }))}
                  options={toneOptions.map((value) => ({ value, label: value }))}
                />
                <label className="block">
                  <span className="block text-sm font-medium text-text mb-1">
                    ナレッジ・発信コンテキスト
                  </span>
                  <p className="mb-2 text-xs text-text-muted">
                    あなたの専門性・発信背景・ターゲット読者などをAIに伝えるテキストです。アウトプット生成やセミナー作成の精度が上がります。
                  </p>
                  <textarea
                    value={profile.knowledge}
                    onChange={(e) => setProfile((current) => ({ ...current, knowledge: e.target.value }))}
                    placeholder={"例）私はAI活用×Instagram集客を専門とする個人クリエイターです。\n主なターゲットは地方の女性起業家（30〜50代）で、難しい専門用語を使わず、すぐに行動できる実用的なノウハウを届けています。\nSNSの発信歴は3年で、フォロワーは約2,000人です。"}
                    rows={6}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-accent resize-none leading-relaxed"
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
