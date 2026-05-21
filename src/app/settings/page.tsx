"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { AlertCircle, CheckCircle, Cpu, KeyRound, Settings, User, Save } from "lucide-react";

type ProfileForm = {
  name: string;
  role: string;
  themes: string[];
  outputChannels: string[];
  tone: string;
};

type AiProviderOption = {
  value: string;
  label: string;
  defaultModel: string;
  modelsSource?: "live" | "fallback";
  models: { value: string; label: string }[];
};

type AiSettingsForm = {
  provider: string;
  model: string;
  apiKey: string;
  hasApiKey: boolean;
  keySource: string;
  providers: AiProviderOption[];
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

function getModelOptions(settings: AiSettingsForm): { value: string; label: string }[] {
  const provider = settings.providers.find((item) => item.value === settings.provider);
  const options = provider?.models || [];
  if (settings.model && !options.some((option) => option.value === settings.model)) {
    return [{ value: settings.model, label: settings.model }, ...options];
  }
  return options;
}

function getCurrentProviderOption(settings: AiSettingsForm): AiProviderOption | undefined {
  return settings.providers.find((item) => item.value === settings.provider);
}

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState("loading");
  const [aiSettings, setAiSettings] = useState<AiSettingsForm>({
    provider: "gemini",
    model: "gemini-2.0-flash",
    apiKey: "",
    hasApiKey: false,
    keySource: "none",
    providers: [],
  });
  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    role: "",
    themes: [],
    outputChannels: [],
    tone: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [statusRes, profileRes, aiRes] = await Promise.all([
          fetch("/api/settings/status"),
          fetch("/api/settings/profile"),
          fetch("/api/settings/ai"),
        ]);
        const statusData = await statusRes.json();
        const profileData = await profileRes.json();
        const aiData = await aiRes.json();
        if (cancelled) return;

        setAiProvider(statusData.aiProvider || "mock");
        setAiSettings({
          provider: aiData.provider || "gemini",
          model: aiData.model || "gemini-2.0-flash",
          apiKey: "",
          hasApiKey: Boolean(aiData.hasApiKey),
          keySource: aiData.keySource || "none",
          providers: aiData.providers || [],
        });
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

  const handleAiProviderChange = (provider: string) => {
    const option = aiSettings.providers.find((item) => item.value === provider);
    setAiSettings((current) => ({
      ...current,
      provider,
      model: option?.defaultModel || current.model,
    }));
  };

  const handleSaveAi = async (clearApiKey = false) => {
    setSavingAi(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiSettings.provider,
          model: aiSettings.model,
          apiKey: clearApiKey ? "" : aiSettings.apiKey,
          clearApiKey,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "AI設定の保存に失敗しました");
        return;
      }

      setAiProvider(data.provider);
      setAiSettings((current) => ({
        ...current,
        provider: data.provider,
        model: data.model,
        apiKey: "",
        hasApiKey: Boolean(data.hasApiKey),
        keySource: data.keySource || "none",
      }));
      setMessage(clearApiKey ? "保存済みAPIキーを削除しました。" : "AI設定を保存しました。");
    } catch {
      setError("AI設定の保存に失敗しました");
    } finally {
      setSavingAi(false);
    }
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/ai", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "AI接続テストに失敗しました");
        return;
      }
      setMessage(`AI接続テストに成功しました。カテゴリ: ${data.category}`);
    } catch {
      setError("AI接続テストに失敗しました");
    } finally {
      setTestingAi(false);
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

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-text">AI Provider</h3>
          </div>
          <Badge variant={aiSettings.hasApiKey ? "success" : "warning"}>
            {aiSettings.hasApiKey
              ? aiSettings.keySource === "ui"
                ? "UIキー設定済み"
                : "環境変数キー使用中"
              : "APIキー未設定"}
          </Badge>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-border-light rounded-xl px-4 py-3">
            <span className="text-sm text-text">現在のProvider</span>
            <Badge variant="success">{aiProvider}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Provider"
              value={aiSettings.provider}
              onChange={(e) => handleAiProviderChange(e.target.value)}
              options={aiSettings.providers.map((provider) => ({
                value: provider.value,
                label: provider.label,
              }))}
            />
            <div>
              <Select
                label="モデル"
                value={aiSettings.model}
                onChange={(e) =>
                  setAiSettings((current) => ({ ...current, model: e.target.value }))
                }
                options={getModelOptions(aiSettings)}
              />
              <p className="mt-1.5 text-xs text-text-muted">
                {getCurrentProviderOption(aiSettings)?.modelsSource === "live"
                  ? "公式APIから取得した最新候補です。"
                  : "公式APIで取得できない場合の推奨候補です。"}
              </p>
            </div>
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-text mb-1.5">APIキー</span>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={aiSettings.apiKey}
                placeholder={
                  aiSettings.hasApiKey
                    ? "変更する場合だけ新しいAPIキーを入力"
                    : "APIキーを入力"
                }
                onChange={(e) =>
                  setAiSettings((current) => ({ ...current, apiKey: e.target.value }))
                }
                className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-text outline-none focus:border-accent"
              />
            </div>
          </label>
          <div className="rounded-xl border border-warning/20 bg-warning-light px-4 py-3 text-sm text-text-secondary">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
              <p>
                APIキーは暗号化してDBに保存し、ブラウザには再表示しません。
                公開運用ではVercel Deployment Protectionを有効にしたまま使ってください。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button
              onClick={() => handleSaveAi(false)}
              disabled={savingAi || testingAi}
              loading={savingAi}
              loadingLabel="保存中..."
              className="w-full sm:w-auto"
            >
              <Save className="w-4 h-4 mr-1" />
              AI設定を保存
            </Button>
            <Button
              variant="secondary"
              onClick={handleTestAi}
              disabled={savingAi || testingAi}
              loading={testingAi}
              loadingLabel="テスト中..."
              className="w-full sm:w-auto"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              接続テスト
            </Button>
            {aiSettings.keySource === "ui" && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("保存済みAPIキーを削除しますか？この操作は元に戻せません。")) {
                    void handleSaveAi(true);
                  }
                }}
                disabled={savingAi}
                className="w-full text-danger hover:text-danger sm:w-auto"
              >
                保存済みキーを削除
              </Button>
            )}
          </div>
          <p className="text-xs text-text-muted">
            対応Provider: Gemini / OpenAI / Claude / Grok / Kimi。APIキーはサーバー側だけで使用します。
          </p>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-text">プロフィール</h3>
          </div>
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
          </div>
        )}
      </Card>
    </div>
  );
}
