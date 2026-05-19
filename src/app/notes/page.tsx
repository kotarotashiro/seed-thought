"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FileText, Search, Trash2 } from "lucide-react";

export default function NotesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const reloadSessions = async () => {
    try {
      const res = await fetch("/api/deep-dive/sessions");
      const data = await res.json();
      const completedSessions = (data || []).filter(
        (s: { status: string }) => s.status === "completed"
      );
      setSessions(completedSessions);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialSessions() {
      try {
        const res = await fetch("/api/deep-dive/sessions");
        const data = await res.json();
        const completedSessions = (data || []).filter(
          (s: { status: string }) => s.status === "completed"
        );
        if (!cancelled) setSessions(completedSessions);
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitialSessions();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSession = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`選択した要点まとめ ${selectedIds.length}件を削除しますか？`)) return;

    setDeleting(true);
    try {
      await Promise.all(
        selectedIds.map((id) => fetch(`/api/deep-dive/sessions/${id}`, { method: "DELETE" }))
      );
      setSelectedIds([]);
      await reloadSessions();
    } finally {
      setDeleting(false);
    }
  };

  const genres = [
    ...new Set(
      sessions
        .map((s) => s.post?.classification?.primaryCategory)
        .filter(Boolean)
    ),
  ] as string[];

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      !searchQuery ||
      session.finalSummary?.includes(searchQuery) ||
      session.userFinalNote?.includes(searchQuery) ||
      session.post?.text?.includes(searchQuery);

    const matchesGenre =
      !selectedGenre ||
      session.post?.classification?.primaryCategory === selectedGenre;

    return matchesSearch && matchesGenre;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <FileText className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">要点まとめ</h1>
          <p className="text-sm text-text-secondary">
            深掘りで生まれた学びや自分の言葉を一覧化
          </p>
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-muted">
            {selectedIds.length > 0 ? `${selectedIds.length}件を選択中` : "削除したい要点まとめを選択できます"}
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={deleteSelected}
            disabled={selectedIds.length === 0}
            loading={deleting}
            loadingLabel="削除中..."
            className="w-full sm:w-auto"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            選択した要点を削除
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="学びを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <option value="">すべてのジャンル</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-6 animate-pulse">
              <div className="h-4 bg-border-light rounded w-1/3 mb-3" />
              <div className="h-3 bg-border-light rounded w-full mb-2" />
              <div className="h-3 bg-border-light rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <FileText className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text mb-2">まだ要点がありません</h3>
          <p className="text-sm text-text-secondary">
            深掘りを完了すると、ここに学びが蓄積されます。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const userNotes = session.steps
              ?.filter((s: { userNote: string | null }) => s.userNote)
              .map((s: { title: string; userNote: string }) => ({
                title: s.title,
                note: s.userNote,
              })) || [];

            return (
              <Card key={session.id}>
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(session.id)}
                    onChange={() => toggleSession(session.id)}
                    className="h-4 w-4 accent-accent"
                    aria-label="要点まとめを選択"
                  />
                  <span className="text-xs text-text-muted">選択</span>
                </div>
                {/* Genre and Date */}
                <div className="flex items-center gap-2 mb-3">
                  {session.post?.classification && (
                    <Badge>{session.post.classification.primaryCategory}</Badge>
                  )}
                  <span className="text-xs text-text-muted">
                    {new Date(session.completedAt || session.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>

                {/* Original Post */}
                <p className="text-xs text-text-muted mb-2 line-clamp-1">
                  元投稿: {session.post?.text}
                </p>

                {/* Learning */}
                {session.finalSummary && (
                  <div className="bg-accent-subtle rounded-xl p-4 mb-3">
                    <p className="text-xs font-medium text-accent mb-1">💡 今回の学び</p>
                    <p className="text-sm text-text">{session.finalSummary}</p>
                  </div>
                )}

                {/* User Notes */}
                {userNotes.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs font-medium text-text-secondary">✍️ 自分の言葉まとめ</p>
                    {userNotes.slice(0, 3).map((note: { title: string; note: string }, i: number) => (
                      <div key={i} className="bg-border-light rounded-lg p-3">
                        <p className="text-xs text-text-muted mb-0.5">{note.title}</p>
                        <p className="text-sm text-text">{note.note}</p>
                      </div>
                    ))}
                    {userNotes.length > 3 && (
                      <p className="text-xs text-text-muted">
                        他 {userNotes.length - 3} 件のメモ
                      </p>
                    )}
                  </div>
                )}

                {/* Final Note */}
                {session.userFinalNote && (
                  <div className="bg-border-light rounded-xl p-4">
                    <p className="text-xs font-medium text-text-secondary mb-1">🔧 自分の仕事で使うなら</p>
                    <p className="text-sm text-text">{session.userFinalNote}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
