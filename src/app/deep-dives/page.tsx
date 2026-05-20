"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Layers, Brain, BookOpen, ArrowRight, CheckCircle, Clock, Trash2 } from "lucide-react";

export default function DeepDivesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isOrphanSession(session: any) {
    if (session.status !== "in_progress") return false;
    if (session.currentStep !== 0) return false;
    const steps: { userNote: string | null }[] = session.steps || [];
    return steps.every((s) => !s.userNote);
  }

  const reloadSessions = async () => {
    try {
      const res = await fetch("/api/deep-dive/sessions");
      const data = await res.json();
      setSessions((data || []).filter((s: unknown) => !isOrphanSession(s)));
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
        if (!cancelled) setSessions((data || []).filter((s: unknown) => !isOrphanSession(s)));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSession = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`選択した深掘り履歴 ${selectedIds.length}件を削除しますか？`)) return;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <Layers className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">深掘り履歴</h1>
          <p className="text-sm text-text-secondary">
            過去の深掘りセッションを見返せます
          </p>
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                selectedIds.length === sessions.length
                  ? setSelectedIds([])
                  : setSelectedIds(sessions.map((s) => s.id))
              }
            >
              {selectedIds.length === sessions.length && sessions.length > 0 ? "全解除" : "全選択"}
            </Button>
            <p className="text-sm text-text-muted">
              {selectedIds.length > 0 ? `${selectedIds.length}件選択中` : ""}
            </p>
          </div>
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
            削除 ({selectedIds.length})
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse">
              <div className="h-4 bg-border-light rounded w-3/4 mb-3" />
              <div className="h-3 bg-border-light rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <Layers className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text mb-2">まだ深掘りセッションがありません</h3>
          <p className="text-sm text-text-secondary mb-4">
            ホームから投稿を選んで深掘りを始めましょう。
          </p>
          <Link href="/">
            <Button>ホームへ</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isCompleted = session.status === "completed";
            const modePath = session.mode === "thought_lens" ? "thought" : "learning";
            const completedSteps = session.steps?.filter((s: { completed: boolean }) => s.completed).length || 0;
            const totalSteps = session.steps?.length || 0;

            return (
              <Card key={session.id} hoverable>
                <div className="flex items-start justify-between gap-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(session.id)}
                    onChange={() => toggleSession(session.id)}
                    className="mt-1 h-4 w-4 flex-shrink-0 accent-accent"
                    aria-label="深掘り履歴を選択"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {session.mode === "thought_lens" ? (
                        <Brain className="w-4 h-4 text-purple-600" />
                      ) : (
                        <BookOpen className="w-4 h-4 text-blue-600" />
                      )}
                      <span className="text-sm font-medium text-text">
                        {session.mode === "thought_lens" ? "思考レンズ" : "学習レッスン"}
                      </span>
                      {isCompleted ? (
                        <Badge variant="success">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          完了
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <Clock className="w-3 h-3 mr-1" />
                          進行中 {completedSteps}/{totalSteps}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-text leading-relaxed line-clamp-2 mb-2">
                      {session.post?.text || ""}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>
                        作成: {new Date(session.createdAt).toLocaleDateString("ja-JP")}
                      </span>
                      {session.completedAt && (
                        <span>
                          完了: {new Date(session.completedAt).toLocaleDateString("ja-JP")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={
                      isCompleted
                        ? `/deep-dive/${session.id}/complete`
                        : `/deep-dive/${session.id}/${modePath}`
                    }
                  >
                    <Button variant="secondary" size="sm">
                      {isCompleted ? "見る" : "続ける"}
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
