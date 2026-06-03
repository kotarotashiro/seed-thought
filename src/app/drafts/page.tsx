"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle,
  Database,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAlert, useConfirm } from "@/components/ui/DialogProvider";
import { ExportButton } from "@/components/share/ExportButton";

interface Draft {
  id: string;
  content: string;
  status: "pending" | "approved" | "rejected" | "posted";
  postedUrl: string | null;
  createdAt: string;
  learningCard: { id: string; sourcePostId: string; title: string; summary: string } | null;
}

// ─── X Draft Section ─────────────────────────────────────────────────────────

function XDraftsSection() {
  const confirm = useConfirm();
  const alert = useAlert();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/drafts");
        const data = await res.json();
        if (!cancelled) setDrafts(data.drafts || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const patch = async (draftId: string, payload: object) => {
    const res = await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json() as Promise<{ draft?: Draft; error?: string }>;
  };

  const approve = async (draftId: string) => {
    setActionId(draftId);
    try {
      const data = await patch(draftId, { status: "approved" });
      if (data.draft) setDrafts((prev) => prev.map((d) => (d.id === draftId ? data.draft! : d)));
    } finally {
      setActionId(null);
    }
  };

  const reject = async (draftId: string) => {
    setActionId(draftId);
    try {
      const data = await patch(draftId, { status: "rejected" });
      if (data.draft) setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } finally {
      setActionId(null);
    }
  };

  const saveEdit = async (draftId: string) => {
    setActionId(draftId);
    try {
      const data = await patch(draftId, { content: editContent });
      if (data.draft) setDrafts((prev) => prev.map((d) => (d.id === draftId ? data.draft! : d)));
      setEditingId(null);
    } finally {
      setActionId(null);
    }
  };

  const postToX = async (draftId: string) => {
    const ok = await confirm({
      message: "このX投稿を今すぐ送信しますか？",
      confirmLabel: "送信する",
    });
    if (!ok) return;
    setActionId(draftId);
    try {
      const res = await fetch(`/api/drafts/${draftId}`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; url?: string | null; error?: string };
      if (!res.ok) {
        await alert(data.error || "投稿に失敗しました");
        return;
      }
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setActionId(null);
    }
  };

  const deleteDraft = async (draftId: string) => {
    const ok = await confirm({
      message: "この下書きを削除しますか？",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    setActionId(draftId);
    try {
      await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        読み込み中…
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <Card className="text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 opacity-30" />
        <p className="text-sm text-text-secondary">下書きはまだありません。</p>
        <p className="mt-1 text-xs text-text-muted">
          学びカードを「保存済み」にすると、下書きが自動生成されます。
        </p>
        <Link href="/knowhow" className="mt-4 inline-block">
          <Button variant="secondary" size="sm">学びメモへ</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {drafts.map((draft) => (
        <Card key={draft.id} padding="lg" className="space-y-3">
          {draft.learningCard && (
            <div className="flex items-start gap-2">
              <span className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-medium text-accent">
                元カード
              </span>
              <Link
                href={`/posts/${draft.learningCard.sourcePostId}/learning`}
                className="text-xs text-text-secondary hover:underline"
              >
                {draft.learningCard.title}
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                draft.status === "approved"
                  ? "bg-success-light text-success"
                  : "bg-border-light text-text-muted"
              }`}
            >
              {draft.status === "approved" ? "承認済み" : "確認待ち"}
            </span>
            <span className="text-[11px] text-text-muted">
              {new Date(draft.createdAt).toLocaleString("ja-JP")}
            </span>
          </div>

          {editingId === draft.id ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveEdit(draft.id)}
                  loading={actionId === draft.id}
                  loadingLabel="保存中…"
                >
                  保存
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(null)}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap rounded-xl bg-border-light/50 px-4 py-3 text-sm leading-relaxed text-text">
              {draft.content}
            </p>
          )}

          {editingId !== draft.id && (
            <div className="flex flex-wrap gap-2">
              {draft.status !== "approved" && (
                <Button
                  size="sm"
                  onClick={() => approve(draft.id)}
                  loading={actionId === draft.id}
                  loadingLabel="処理中…"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  承認
                </Button>
              )}
              {draft.status === "approved" && (
                <Button
                  size="sm"
                  onClick={() => postToX(draft.id)}
                  loading={actionId === draft.id}
                  loadingLabel="投稿中…"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Xに投稿
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingId(draft.id);
                  setEditContent(draft.content);
                }}
              >
                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                編集
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reject(draft.id)}
                loading={actionId === draft.id}
                loadingLabel="処理中…"
              >
                <XIcon className="mr-1.5 h-3.5 w-3.5" />
                却下
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteDraft(draft.id)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                削除
              </Button>
              {draft.postedUrl && (
                <a
                  href={draft.postedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  投稿を見る
                </a>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Notion Sync Section ──────────────────────────────────────────────────────

function NotionSyncSection() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [databaseId, setDatabaseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notion/settings")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setHasApiKey(Boolean(data.hasApiKey));
        setDatabaseId(data.databaseId || "");
      })
      .catch(() => {
        if (!cancelled) setError("Notion設定の読み込みに失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/notion/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "同期に失敗しました");
        return;
      }
      setMessage(
        `同期完了: ${data.synced}件を新規追加、${data.skipped}件はスキップ${data.errors?.length ? `（${data.errors.length}件エラー）` : ""}`
      );
    } catch {
      setError("Notion同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="h-8 rounded-xl bg-border-light animate-pulse" />;
  }

  const canSync = hasApiKey && Boolean(databaseId);

  return (
    <div className="space-y-3">
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
      <p className="text-sm text-text-secondary">
        保存済みの学びメモをNotionデータベースに同期します。
      </p>
      {canSync ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          loading={syncing}
          loadingLabel="同期中…"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Notionに同期
        </Button>
      ) : (
        <div className="space-y-2">
          <Button variant="secondary" size="sm" disabled>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Notionに同期
          </Button>
          <p className="text-xs text-text-muted">
            Notion連携が未設定です。
            <Link href="/settings" className="ml-1 text-accent hover:underline">
              設定でNotion連携を登録してください
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Export Section ───────────────────────────────────────────────────────────

function ExportSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        保存済みの学びメモをまとめてダウンロードできます。
      </p>
      <div className="flex flex-wrap gap-2">
        <ExportButton ids={[]} format="zip" />
        <ExportButton ids={[]} format="bundle" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DraftsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">出す</h1>
        <p className="mt-1 text-sm text-text-secondary">発信・書き出し</p>
      </div>

      {/* X下書き */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <FileText className="h-4 w-4 text-text-secondary" />
          <h2 className="text-base font-bold text-text">X下書き</h2>
        </div>
        <XDraftsSection />
      </section>

      {/* Notion同期 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Database className="h-4 w-4 text-text-secondary" />
          <h2 className="text-base font-bold text-text">Notion同期</h2>
        </div>
        <NotionSyncSection />
      </section>

      {/* 書き出し */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Download className="h-4 w-4 text-text-secondary" />
          <h2 className="text-base font-bold text-text">書き出し</h2>
        </div>
        <ExportSection />
      </section>
    </div>
  );
}
