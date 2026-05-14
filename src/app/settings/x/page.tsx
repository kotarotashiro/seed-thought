"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  Link2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  Unplug,
} from "lucide-react";

function parseAccountScopes(account: { scopesJson?: string | null } | null | undefined): string[] {
  if (!account?.scopesJson) return [];
  try {
    const scopes = JSON.parse(account.scopesJson);
    return Array.isArray(scopes) ? scopes.map(String) : [];
  } catch {
    return [];
  }
}

function getMissingSyncScopes(syncType: string, scopes: string[]): string[] {
  const required = new Set<string>();
  if (syncType === "likes" || syncType === "both") required.add("like.read");
  if (syncType === "bookmarks" || syncType === "both") required.add("bookmark.read");
  return [...required].filter((scope) => !scopes.includes(scope));
}

function toSyncErrorMessage(message: string): string {
  if (message.includes("403") || message.toLowerCase().includes("forbidden")) {
    return "X API権限が不足しています。いいね同期には like.read、ブックマーク同期には bookmark.read が必要です。X Developer PortalとVercelの X_SCOPES を更新後、接続解除して再接続してください。";
  }
  return message;
}

export default function XSettingsPage() {
  const [xStatus, setXStatus] = useState<{
    connected: boolean;
    account: {
      username: string;
      displayName?: string | null;
      scopesJson?: string | null;
    } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    syncRuns: any[];
    config?: {
      clientIdConfigured: boolean;
      redirectUri: string;
      scopes: string;
      tokenEncryptionConfigured: boolean;
    };
  } | null>(null);

  const [syncType, setSyncType] = useState("both");
  const [limit, setLimit] = useState("25");
  const [syncing, setSyncing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("error");
  });
  const [loading, setLoading] = useState(true);
  const accountScopes = parseAccountScopes(xStatus?.account);
  const missingSyncScopes = getMissingSyncScopes(syncType, accountScopes);

  const loadStatus = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/x/status");
      const data = await res.json();
      setXStatus(data);
    } catch (err) {
      console.error("Failed to fetch X status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialStatus() {
      try {
        const res = await fetch("/api/x/status");
        const data = await res.json();
        if (cancelled) return;
        setXStatus(data);
      } catch (err) {
        console.error("Failed to fetch X status:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitialStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/x/auth");
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("X認証の開始に失敗しました");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Xアカウントの接続を解除しますか？")) return;
    try {
      await fetch("/api/x/status", { method: "DELETE" });
      loadStatus();
    } catch {
      setError("接続解除に失敗しました");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      const res = await fetch("/api/x/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncType,
          limit: parseInt(limit),
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(toSyncErrorMessage(data.error));
      } else if (data.results?.errorMessage) {
        setError(toSyncErrorMessage(data.results.errorMessage));
        setSyncResult(null);
        loadStatus();
      } else {
        setSyncResult(data.results);
        loadStatus(); // Refresh sync history
      }
    } catch {
      setError("同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-border-light rounded w-32" />
        <div className="h-40 bg-border-light rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <Link2 className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">X連携</h1>
          <p className="text-sm text-text-secondary">
            Xアカウントを接続して、いいね・ブックマークを同期
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-danger-light border border-danger/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-danger">エラー</p>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-text-muted hover:text-text">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connection Status */}
      <Card>
        <h3 className="text-base font-bold text-text mb-4">接続状態</h3>
        {xStatus?.connected && xStatus.account ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-success" />
              <div>
                <p className="text-sm font-medium text-text">
                  @{xStatus.account.username} に接続中
                </p>
                <p className="text-xs text-text-muted">
                  {xStatus.account.displayName}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleDisconnect}>
              <Unplug className="w-4 h-4 mr-1" />
              接続解除
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-text-muted" />
              <p className="text-sm text-text-secondary">Xアカウント未接続</p>
            </div>
            <Button
              onClick={handleConnect}
              disabled={
                xStatus?.config
                  ? !xStatus.config.clientIdConfigured ||
                    !xStatus.config.tokenEncryptionConfigured
                  : false
              }
            >
              <Link2 className="w-4 h-4 mr-2" />
              Xアカウントを接続する
            </Button>
            {xStatus?.config && (
              <div className="bg-border-light rounded-xl p-3 space-y-1">
                <p className="text-xs text-text-secondary">
                  Client ID: {xStatus.config.clientIdConfigured ? "設定済み" : "未設定"}
                </p>
                <p className="text-xs text-text-secondary">
                  Token暗号化キー: {xStatus.config.tokenEncryptionConfigured ? "設定済み" : "未設定"}
                </p>
                <p className="text-xs text-text-muted break-all">
                  Callback URL: {xStatus.config.redirectUri}
                </p>
                <p className="text-xs text-text-muted break-all">
                  Scopes: {xStatus.config.scopes}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Sync Settings */}
      {xStatus?.connected && (
        <Card>
          <h3 className="text-base font-bold text-text mb-4">同期設定</h3>
          <div className="space-y-4">
            {missingSyncScopes.length > 0 && (
              <div className="rounded-xl border border-warning/20 bg-warning-light px-4 py-3">
                <p className="text-sm font-medium text-warning">同期権限が不足しています</p>
                <p className="mt-1 text-sm text-text-secondary">
                  現在のX接続には {missingSyncScopes.join(" / ")} が含まれていません。
                  X Developer PortalとVercelの X_SCOPES に必要な権限を追加し、
                  接続解除後に再接続してください。
                </p>
                <p className="mt-2 text-xs text-text-muted break-all">
                  現在の接続スコープ: {accountScopes.join(" ") || "取得できません"}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="同期対象"
                value={syncType}
                onChange={(e) => setSyncType(e.target.value)}
                options={[
                  { value: "both", label: "いいね＋ブックマーク" },
                  { value: "likes", label: "いいねのみ" },
                  { value: "bookmarks", label: "ブックマークのみ" },
                ]}
              />
              <Select
                label="取得件数"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                options={[
                  { value: "10", label: "10件" },
                  { value: "25", label: "25件" },
                  { value: "50", label: "50件" },
                  { value: "100", label: "100件" },
                ]}
              />
            </div>

            <Button
              onClick={handleSync}
              disabled={syncing || missingSyncScopes.length > 0}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "同期中..." : "手動同期を実行"}
            </Button>

            {/* Sync Result */}
            {syncResult && (
              <div className="bg-success-light rounded-xl p-4">
                <p className="text-sm font-medium text-success mb-2">同期完了</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-text">{syncResult.fetchedCount}</p>
                    <p className="text-xs text-text-muted">取得</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-text">{syncResult.insertedCount}</p>
                    <p className="text-xs text-text-muted">新規保存</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-text">{syncResult.skippedDuplicateCount}</p>
                    <p className="text-xs text-text-muted">重複スキップ</p>
                  </div>
                </div>
                {syncResult.partialErrors?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {syncResult.partialErrors.map((message: string) => (
                      <p key={message} className="text-xs text-warning">
                        {message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Sync History */}
      {xStatus?.syncRuns && xStatus.syncRuns.length > 0 && (
        <Card>
          <h3 className="text-base font-bold text-text mb-4">同期履歴</h3>
          <div className="space-y-2">
            {xStatus.syncRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between bg-border-light rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {run.status === "success" ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : run.status === "failed" ? (
                    <XCircle className="w-4 h-4 text-danger" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-warning animate-spin" />
                  )}
                  <div>
                    <p className="text-sm text-text">
                      {run.syncType === "likes"
                        ? "いいね"
                        : run.syncType === "bookmarks"
                        ? "ブックマーク"
                        : "いいね＋ブックマーク"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(run.startedAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      run.status === "success"
                        ? "success"
                        : run.status === "partial"
                        ? "warning"
                        : run.status === "failed"
                        ? "default"
                        : "warning"
                    }
                  >
                    {run.status === "success"
                      ? `${run.insertedCount}件追加`
                      : run.status === "partial"
                      ? `${run.insertedCount}件追加（一部失敗）`
                      : run.status === "failed"
                      ? "失敗"
                      : "実行中"}
                  </Badge>
                  {run.errorMessage && (
                    <p className="text-xs text-danger mt-1">{toSyncErrorMessage(run.errorMessage)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
