"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OutputTypeCard } from "@/components/outputs/OutputTypeCard";
import { OutputPreview } from "@/components/outputs/OutputPreview";
import { AlertCircle, CheckCircle, Sparkles } from "lucide-react";

const OUTPUT_TYPES = ["x", "instagram", "note", "markdown_log"];
const OUTPUT_LABELS: Record<string, string> = {
  x: "X投稿",
  instagram: "Instagramカルーセル",
  note: "note記事",
  markdown_log: "Markdown学習ログ",
};

interface GeneratedOutputView {
  id: string;
  outputType: string;
  title: string;
  content: string;
  contentJson?: string | Record<string, unknown> | null;
  createdAt: string | Date;
}

export default function CompletePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null);
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [generatedOutput, setGeneratedOutput] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/deep-dive/sessions/${sessionId}`);
        const data = await res.json();
        setSession(data);
      } catch (error) {
        console.error("Failed to fetch session:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [sessionId]);

  const handleGenerate = async () => {
    if (!selectedOutput) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/deep-dive/sessions/${sessionId}/outputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputType: selectedOutput }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "アウトプットの生成に失敗しました");
      }

      const output = await res.json();
      setGeneratedOutput(output);
      if (output.warning) {
        setError(`${output.warning} 代わりに下書きを表示しています。`);
      }
      setSession((prev: { outputs?: GeneratedOutputView[] } | null) =>
        prev
          ? {
              ...prev,
              outputs: [output, ...(prev.outputs || [])],
            }
          : prev
      );
    } catch (error) {
      console.error("Failed to generate output:", error);
      setError(error instanceof Error ? error.message : "アウトプットの生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !session) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-border-light rounded w-48" />
        <div className="h-32 bg-border-light rounded-2xl" />
      </div>
    );
  }

  // Extract learning summaries from steps
  const userNotes = session.steps
    ?.filter((s: { userNote: string | null }) => s.userNote)
    .map((s: { title: string; userNote: string }) => ({
      title: s.title,
      note: s.userNote,
    })) || [];

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-success-light flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">深掘り完了 🎉</h1>
          <p className="text-sm text-text-secondary">
            {session.mode === "thought_lens" ? "思考レンズ" : "学習レッスン"}で深掘りが完了しました
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="space-y-4">
        {/* Learning / Final Summary */}
        {session.finalSummary && (
          <Card>
            <h3 className="text-base font-bold text-text mb-2">💡 今回の学び</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {session.finalSummary}
            </p>
          </Card>
        )}

        {/* User Notes Summary */}
        {userNotes.length > 0 && (
          <Card>
            <h3 className="text-base font-bold text-text mb-3">✍️ 自分の言葉まとめ</h3>
            <div className="space-y-3">
              {userNotes.map((note: { title: string; note: string }, i: number) => (
                <div key={i} className="bg-border-light rounded-xl p-3">
                  <p className="text-xs font-medium text-text-muted mb-1">{note.title}</p>
                  <p className="text-sm text-text">{note.note}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* User Final Note */}
        {session.userFinalNote && (
          <Card>
            <h3 className="text-base font-bold text-text mb-2">🔧 自分の仕事で使うなら</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {session.userFinalNote}
            </p>
          </Card>
        )}
      </div>

      {/* Output Generation */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="text-base font-bold text-text">アウトプット変換</h3>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          深掘りの内容を、発信用コンテンツに変換します。
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OUTPUT_TYPES.map((type) => (
            <OutputTypeCard
              key={type}
              type={type}
              selected={selectedOutput === type}
              onClick={() => {
                setSelectedOutput(type);
                setGeneratedOutput(null);
              }}
            />
          ))}
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!selectedOutput || generating}
          className="w-full"
        >
          {generating ? "生成中..." : "アウトプットを生成する"}
        </Button>

        {error && (
          <div className="mt-4 bg-danger-light border border-danger/20 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}
      </Card>

      {session.outputs?.length > 0 && (
        <Card>
          <h3 className="text-base font-bold text-text mb-3">生成済みアウトプット</h3>
          <div className="space-y-2">
            {session.outputs.map((output: GeneratedOutputView) => (
              <button
                key={output.id}
                onClick={() => {
                  setSelectedOutput(output.outputType);
                  setGeneratedOutput(output);
                  setError(null);
                }}
                className="w-full text-left bg-border-light hover:bg-accent-subtle rounded-xl px-4 py-3 transition-colors"
              >
                <p className="text-sm font-medium text-text">
                  {OUTPUT_LABELS[output.outputType] || output.outputType}: {output.title}
                </p>
                <p className="text-xs text-text-muted">
                  {new Date(output.createdAt).toLocaleString("ja-JP")}
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Generated Output */}
      {generatedOutput && (
        <OutputPreview
          title={generatedOutput.title}
          content={generatedOutput.content}
          contentJson={
            generatedOutput.contentJson
              ? typeof generatedOutput.contentJson === "string"
                ? JSON.parse(generatedOutput.contentJson)
                : generatedOutput.contentJson
              : null
          }
          outputType={selectedOutput || ""}
        />
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => router.push("/deep-dives")} className="flex-1">
          深掘り履歴へ
        </Button>
        <Button variant="secondary" onClick={() => router.push("/")} className="flex-1">
          ホームへ戻る
        </Button>
      </div>
    </div>
  );
}
