"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Cpu,
  Database,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  User,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProfileForm = {
  name: string;
  role: string;
  themes: string[];
  outputChannels: string[];
  tone: string;
  knowledge: string;
};

type AiProviderName = "grok" | "claude" | "openai" | "gemini" | "kimi" | "mock";
type AiTaskName =
  | "classifyPost"
  | "translateText"
  | "generateLearningCard"
  | "generateStrictLearning"
  | "generateOutput"
  | "searchSemantically"
  | "analyzeLikeTrends"
  | "chat";

type KeyStatus = { hasKey: boolean; source: "ui" | "env" | "oauth" | "none" };
type ProviderInfo = { value: AiProviderName; label: string; hasKey: boolean; keySource: string };
type ModelInfo = { id: string; name: string };
type TaskAssignment = { provider: AiProviderName; model: string };

type AiSettings = {
  defaultProvider: AiProviderName;
  defaultModel: string;
  taskAssignments: Partial<Record<AiTaskName, TaskAssignment>>;
  keyStatus: Record<AiProviderName, KeyStatus>;
  providers: ProviderInfo[];
  taskLabels: Record<AiTaskName, string>;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const roleOptions = [
  "AI活用・SNS運用・LINE導線設計を発信する個人クリエイター",
  "AI活用を発信する個人クリエイター",
  "SNS運用・マーケティング支援者",
  "LINE導線設計・店舗集客支援者",
  "セミナー講師・コンテンツ制作者",
];

const themeOptions = [
  "AI活用", "Instagram", "公式LINE", "X運用", "note",
  "チラシ", "セミナー", "マーケティング", "導線設計", "業務効率化",
];

const outputChannelOptions = [
  "X", "Instagram", "note", "ブログ", "YouTube", "公式LINE",
];

const toneOptions = [
  "やさしく、実用的で、少し本音感のある文章",
  "短く、わかりやすく、行動につながる文章",
  "専門的だが、初心者にも伝わる文章",
  "熱量があり、背中を押す文章",
  "落ち着いていて、信頼感のある文章",
];

const ALL_TASKS: AiTaskName[] = [
  "classifyPost", "translateText", "generateLearningCard", "generateStrictLearning",
  "generateOutput", "searchSemantically", "analyzeLikeTrends", "chat",
];

const PROVIDER_NAMES: Record<AiProviderName, string> = {
  grok: "Grok (xAI)",
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  gemini: "Gemini (Google)",
  kimi: "Kimi (Moonshot)",
  mock: "Mock",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toggleListValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((i) => i !== value) : [...values, value];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({
  open, onToggle, icon, title, badge,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 text-left">
      {icon}
      <span className="flex-1 text-base font-bold text-text">{title}</span>
      {badge}
      <ChevronDown
        className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function KeySourceBadge({ source }: { source: string }) {
  if (source === "env") return <Badge variant="learning">環境変数</Badge>;
  if (source === "ui")  return <Badge variant="success">設定済み</Badge>;
  if (source === "oauth") return <Badge variant="success">OAuth</Badge>;
  return null;
}

// ─── AI Settings Section ─────────────────────────────────────────────────────

function AiSettingsSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Partial<Record<AiProviderName, string>>>({});
  const [taskAssignments, setTaskAssignments] = useState<Partial<Record<AiTaskName, TaskAssignment>>>({});
  const [defaultProvider, setDefaultProvider] = useState<AiProviderName>("grok");
  const [defaultModel, setDefaultModel] = useState("");
  const [modelLists, setModelLists] = useState<Partial<Record<AiProviderName, ModelInfo[]>>>({});
  const [modelSources, setModelSources] = useState<Partial<Record<AiProviderName, "live" | "fallback">>>({});
  const [loadingModels, setLoadingModels] = useState<Partial<Record<AiProviderName, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async (provider: AiProviderName) => {
    if (loadingModels[provider]) return;
    setLoadingModels((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch(`/api/settings/ai/models?provider=${provider}`);
      const data = await res.json();
      if (data.models) {
        setModelLists((prev) => ({ ...prev, [provider]: data.models }));
        if (data.source === "live" || data.source === "fallback") {
          setModelSources((prev) => ({ ...prev, [provider]: data.source }));
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingModels((prev) => ({ ...prev, [provider]: false }));
    }
  }, [loadingModels]);

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((data: AiSettings) => {
        setSettings(data);
        setDefaultProvider(data.defaultProvider);
        setDefaultModel(data.defaultModel);
        setTaskAssignments(data.taskAssignments ?? {});
      })
      .catch(() => setError("AI設定の読み込みに失敗しました"));
  }, []);

  // モデル一覧を持っているProviderを表示時に取得
  useEffect(() => {
    if (!open || !settings) return;
    queueMicrotask(() => {
      for (const p of (["grok", "claude", "openai", "gemini", "kimi"] as AiProviderName[])) {
        if (settings.keyStatus[p]?.hasKey && !modelLists[p]) {
          fetchModels(p);
        }
      }
    });
  }, [open, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ※自動モデル修復は誤って正しいモデル(kimi-k2.6 等)を上書きしてしまうリスクがあるため
  // 行わない。ユーザが UI から手動で選び直す前提。

  const getModelsForProvider = (provider: AiProviderName): ModelInfo[] => {
    return modelLists[provider] ?? [];
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const apiKeys: Partial<Record<AiProviderName, string | null>> = {};
      for (const [p, key] of Object.entries(apiKeyInputs)) {
        if (key === "") {
          apiKeys[p as AiProviderName] = null; // 削除
        } else if (key) {
          apiKeys[p as AiProviderName] = key;
        }
      }

      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultProvider,
          defaultModel,
          taskAssignments,
          apiKeys: Object.keys(apiKeys).length > 0 ? apiKeys : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }
      setSettings((prev) => prev ? { ...prev, ...data } : prev);
      setApiKeyInputs({});
      setMessage("AI設定を保存しました");
      // 再取得
      const fresh = await fetch("/api/settings/ai").then((r) => r.json());
      setSettings(fresh);
      setDefaultProvider(fresh.defaultProvider);
      setDefaultModel(fresh.defaultModel);
      setTaskAssignments(fresh.taskAssignments ?? {});
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/ai", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "接続テストに失敗しました");
      } else {
        setMessage(`接続テスト成功: ${data.summary || data.category}`);
      }
    } catch {
      setError("接続テストに失敗しました");
    } finally {
      setTesting(false);
    }
  };

  const getTaskProvider = (task: AiTaskName): AiProviderName =>
    taskAssignments[task]?.provider ?? defaultProvider;

  const getTaskModel = (task: AiTaskName): string =>
    taskAssignments[task]?.model ?? defaultModel;

  const setTaskProvider = (task: AiTaskName, provider: AiProviderName) => {
    const models = getModelsForProvider(provider);
    const model = models[0]?.id ?? defaultModel;
    setTaskAssignments((prev) => ({ ...prev, [task]: { provider, model } }));
    if (!modelLists[provider]) fetchModels(provider);
  };

  const setTaskModel = (task: AiTaskName, model: string) => {
    const provider = getTaskProvider(task);
    setTaskAssignments((prev) => ({ ...prev, [task]: { provider, model } }));
  };

  const handleDefaultProviderChange = (provider: AiProviderName) => {
    setDefaultProvider(provider);
    const models = getModelsForProvider(provider);
    if (models.length > 0) setDefaultModel(models[0].id);
    if (!modelLists[provider]) fetchModels(provider);
  };

  if (!settings) {
    return (
      <div className="mt-4">
        <div className="h-8 bg-border-light rounded-xl animate-pulse" />
      </div>
    );
  }

  const availableProviders = settings.providers.filter((p) => p.value !== "mock");

  return (
    <div className="mt-4 space-y-6">
      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-success/20 bg-success-light px-4 py-3 text-sm text-success flex gap-2 items-start">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {message}
        </div>
      )}

      {/* セクション1: APIキー管理 */}
      <div>
        <p className="text-xs font-semibold text-text-secondary mb-3">APIキー管理</p>
        <div className="space-y-3">
          {availableProviders.map((p) => (
            <div key={p.value} className="rounded-xl border border-border bg-white p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-text">{p.label}</span>
                <KeySourceBadge source={settings.keyStatus[p.value]?.source ?? "none"} />
                {settings.keyStatus[p.value]?.hasKey && modelSources[p.value] === "fallback" && (
                  <Badge variant="warning">モデル一覧取得失敗</Badge>
                )}
                {settings.keyStatus[p.value]?.hasKey && (
                  <CheckCircle className="w-3.5 h-3.5 text-success ml-auto" />
                )}
              </div>
              {p.keySource !== "env" && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInputs[p.value] ?? ""}
                    onChange={(e) =>
                      setApiKeyInputs((prev) => ({ ...prev, [p.value]: e.target.value }))
                    }
                    placeholder={
                      settings.keyStatus[p.value]?.hasKey
                        ? "（設定済み・変更する場合のみ入力）"
                        : "APIキーを入力..."
                    }
                    className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
                  />
                  {settings.keyStatus[p.value]?.source === "ui" && (
                    <button
                      type="button"
                      onClick={() =>
                        setApiKeyInputs((prev) => ({ ...prev, [p.value]: "" }))
                      }
                      className="text-xs text-danger hover:underline whitespace-nowrap"
                    >
                      削除
                    </button>
                  )}
                </div>
              )}
              {p.keySource === "env" && (
                <p className="text-xs text-text-muted">環境変数で設定済みのため変更不可</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* セクション2: デフォルトモデル */}
      <div>
        <p className="text-xs font-semibold text-text-secondary mb-3">デフォルトモデル</p>
        <p className="text-xs text-text-muted mb-3">工程別に指定がない場合にこのProvider・モデルが使われます</p>
        <div className="rounded-xl border border-border bg-white p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-secondary block mb-1">Provider</label>
              <select
                value={defaultProvider}
                onChange={(e) => handleDefaultProviderChange(e.target.value as AiProviderName)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
              >
                {availableProviders.map((p) => (
                  <option key={p.value} value={p.value} disabled={!p.hasKey}>
                    {p.label}{!p.hasKey ? " (未設定)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">
                モデル
                {loadingModels[defaultProvider] && (
                  <Loader2 className="w-3 h-3 animate-spin inline ml-1" />
                )}
              </label>
              {getModelsForProvider(defaultProvider).length > 0 ? (
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
                >
                  {getModelsForProvider(defaultProvider).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="モデル名を入力..."
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* セクション3: 工程別モデル割り当て */}
      <div>
        <p className="text-xs font-semibold text-text-secondary mb-3">工程別モデル割り当て</p>
        <p className="text-xs text-text-muted mb-3">
          空白の工程はデフォルトモデル（{PROVIDER_NAMES[defaultProvider]} / {defaultModel}）を使用
        </p>
        <div className="space-y-2">
          {ALL_TASKS.map((task) => {
            const taskLabel = settings.taskLabels[task] ?? task;
            const taskProvider = getTaskProvider(task);
            const taskModel = getTaskModel(task);
            const models = getModelsForProvider(taskProvider);
            const isCustom = Boolean(taskAssignments[task]);

            return (
              <div key={task} className={`rounded-xl border p-3 ${isCustom ? "border-accent/30 bg-accent-light/30" : "border-border bg-white"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-text">{taskLabel}</span>
                  {isCustom && <Badge variant="learning">カスタム</Badge>}
                  {!isCustom && <span className="text-xs text-text-muted ml-auto">デフォルト使用</span>}
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() =>
                        setTaskAssignments((prev) => {
                          const next = { ...prev };
                          delete next[task];
                          return next;
                        })
                      }
                      className="text-xs text-text-muted hover:text-danger ml-auto"
                    >
                      リセット
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={taskProvider}
                    onChange={(e) => setTaskProvider(task, e.target.value as AiProviderName)}
                    className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-text outline-none focus:border-accent"
                  >
                    {availableProviders.map((p) => (
                      <option key={p.value} value={p.value} disabled={!p.hasKey}>
                        {p.label}{!p.hasKey ? " (未設定)" : ""}
                      </option>
                    ))}
                  </select>
                  {models.length > 0 ? (
                    <select
                      value={taskModel}
                      onChange={(e) => setTaskModel(task, e.target.value)}
                      className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-text outline-none focus:border-accent"
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={taskModel}
                      onChange={(e) => setTaskModel(task, e.target.value)}
                      placeholder="モデル名..."
                      className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-text outline-none focus:border-accent"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 推奨プリセット */}
      <div>
        <p className="text-xs font-semibold text-text-secondary mb-2">プリセット</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTaskAssignments({})}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text hover:border-accent"
          >
            すべてデフォルト
          </button>
          {settings.keyStatus.claude?.hasKey && (
            <button
              type="button"
              onClick={() => {
                const claudeModels = getModelsForProvider("claude");
                const opusModel = claudeModels.find((m) => m.id.includes("opus"))?.id
                  ?? claudeModels[0]?.id
                  ?? "claude-opus-4-7";
                setTaskAssignments({
                  generateLearningCard: { provider: "claude", model: opusModel },
                  generateStrictLearning: { provider: "claude", model: opusModel },
                });
              }}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text hover:border-accent"
            >
              学習系のみ Claude Opus
            </button>
          )}
        </div>
      </div>

      {/* アクション */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving} size="sm" loading={saving} loadingLabel="保存中...">
          <Save className="w-4 h-4 mr-1.5" />
          設定を保存
        </Button>
        <Button variant="secondary" onClick={handleTest} disabled={testing} size="sm">
          {testing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
          接続テスト
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    notion: false,
    profile: false,
    ai: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [profile, setProfile] = useState<ProfileForm>({
    name: "", role: "", themes: [], outputChannels: [], tone: "", knowledge: "",
  });
  const [customTheme, setCustomTheme] = useState("");
  const [customChannel, setCustomChannel] = useState("");
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
    return () => { cancelled = true; };
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
          <p className="text-sm text-text-secondary">アプリケーションの設定を編集</p>
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

      {/* AI Settings */}
      <Card>
        <SectionHeader
          open={openSections.ai}
          onToggle={() => toggleSection("ai")}
          icon={<Cpu className="w-5 h-5 text-accent flex-shrink-0" />}
          title="AI設定"
        />
        {openSections.ai && (
          <AiSettingsSection open={openSections.ai} onToggle={() => toggleSection("ai")} />
        )}
      </Card>

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
              <label className="text-xs font-semibold text-text-secondary">データベースID</label>
              <input
                type="text"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text outline-none focus:border-accent"
              />
              <p className="text-xs text-text-muted">NotionのデータベースURLの末尾32文字</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveNotion} disabled={savingNotion} size="sm">
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
                    onChange={(e) => setProfile((c) => ({ ...c, name: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-text mb-1">役割</span>
                  <input
                    list="role-options"
                    value={profile.role}
                    onChange={(e) => setProfile((c) => ({ ...c, role: e.target.value }))}
                    placeholder="例）AI活用を発信する個人クリエイター"
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-accent"
                  />
                  <datalist id="role-options">
                    {roleOptions.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </label>
                <div>
                  <p className="mb-2 text-sm font-medium text-text">テーマ</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[...new Set([...themeOptions, ...profile.themes])].map((theme) => (
                      <label
                        key={theme}
                        className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-text"
                      >
                        <input
                          type="checkbox"
                          checked={profile.themes.includes(theme)}
                          onChange={() =>
                            setProfile((c) => ({
                              ...c,
                              themes: toggleListValue(c.themes, theme),
                            }))
                          }
                          className="h-4 w-4 accent-accent"
                        />
                        {theme}
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={customTheme}
                      onChange={(e) => setCustomTheme(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = customTheme.trim();
                          if (v) {
                            setProfile((c) => ({
                              ...c,
                              themes: c.themes.includes(v) ? c.themes : [...c.themes, v],
                            }));
                            setCustomTheme("");
                          }
                        }
                      }}
                      placeholder="その他のテーマを追加（Enter）"
                      className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-text">発信チャンネル</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[...new Set([...outputChannelOptions, ...profile.outputChannels])].map((channel) => (
                      <label
                        key={channel}
                        className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-text"
                      >
                        <input
                          type="checkbox"
                          checked={profile.outputChannels.includes(channel)}
                          onChange={() =>
                            setProfile((c) => ({
                              ...c,
                              outputChannels: toggleListValue(c.outputChannels, channel),
                            }))
                          }
                          className="h-4 w-4 accent-accent"
                        />
                        {channel}
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={customChannel}
                      onChange={(e) => setCustomChannel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = customChannel.trim();
                          if (v) {
                            setProfile((c) => ({
                              ...c,
                              outputChannels: c.outputChannels.includes(v)
                                ? c.outputChannels
                                : [...c.outputChannels, v],
                            }));
                            setCustomChannel("");
                          }
                        }
                      }}
                      placeholder="その他のチャンネルを追加（Enter）"
                      className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-accent"
                    />
                  </div>
                </div>
                <label className="block">
                  <span className="block text-sm font-medium text-text mb-1">トーン</span>
                  <input
                    list="tone-options"
                    value={profile.tone}
                    onChange={(e) => setProfile((c) => ({ ...c, tone: e.target.value }))}
                    placeholder="例）やさしく、実用的で、行動につながる文章"
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-accent"
                  />
                  <datalist id="tone-options">
                    {toneOptions.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-text mb-1">
                    ナレッジ・発信コンテキスト
                  </span>
                  <p className="mb-2 text-xs text-text-muted">
                    あなたの専門性・発信背景・ターゲット読者などをAIに伝えるテキストです。アウトプット生成やセミナー作成の精度が上がります。
                  </p>
                  <textarea
                    value={profile.knowledge}
                    onChange={(e) => setProfile((c) => ({ ...c, knowledge: e.target.value }))}
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
