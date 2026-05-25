"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Edit2,
  ExternalLink,
  Loader2,
  Send,
  Trash2,
  X as XIcon,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Draft {
  id: string;
  content: string;
  status: "pending" | "approved" | "rejected" | "posted";
  postedUrl: string | null;
  createdAt: string;
  learningCard: { id: string; title: string; summary: string } | null;
}

export default function DraftsPage() {
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
    if (!confirm("このX投稿を今すぐ送信しますか？")) return;
    setActionId(draftId);
    try {
      const res = await fetch(`/api/drafts/${draftId}`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; url?: string | null; error?: string };
      if (!res.ok) {
        alert(data.error || "投稿に失敗しました");
        return;
      }
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setActionId(null);
    }
  };

  const deleteDraft = async (draftId: string) => {
    if (!confirm("この下書きを削除しますか？")) return;
    setActionId(draftId);
    try {
      await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
          <FileText className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text sm:text-2xl">X投稿の下書き</h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            学びカードから自動生成されたX投稿案を確認・編集してから投稿できます
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          読み込み中…
        </div>
      ) : drafts.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <Card key={draft.id} padding="lg" className="space-y-3">
              {draft.learningCard && (
                <div className="flex items-start gap-2">
                  <span className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-medium text-accent">
                    元カード
                  </span>
                  <Link
                    href={`/posts/${draft.learningCard.id}/learning`}
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
                      ? "bg-emerald-100 text-emerald-700"
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
                    className="w-full resize-y rounded-xl border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
      )}
    </div>
  );
}
