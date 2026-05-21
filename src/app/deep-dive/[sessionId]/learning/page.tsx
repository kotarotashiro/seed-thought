"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Button } from "@/components/ui/Button";
import { PostMiniCard } from "@/components/posts/PostMiniCard";
import { StepProgress } from "@/components/deep-dive/StepProgress";
import { AiContentCard } from "@/components/deep-dive/AiContentCard";
import { UserNoteBox } from "@/components/deep-dive/UserNoteBox";
import { ArrowLeft, ArrowRight, BookOpen, Save } from "lucide-react";

export default function LearningLessonPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const safeBack = useSafeBack();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saved" | "unsaved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/deep-dive/sessions/${sessionId}`);
        const data = await res.json();
        setSession(data);
        setCurrentStep(data.currentStep || 0);

        const notes: Record<number, string> = {};
        data.steps?.forEach((step: { stepIndex: number; userNote: string | null }) => {
          if (step.userNote) notes[step.stepIndex] = step.userNote;
        });
        setUserNotes(notes);
      } catch (error) {
        console.error("Failed to fetch session:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [sessionId]);

  const saveCurrentStep = useCallback(async (completed = true, nextStep = currentStep) => {
    if (!session) return;
    const step = session.steps[currentStep];
    if (!step) return;

    setSaving(true);
    try {
      await fetch(`/api/deep-dive/steps/${step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userNote: userNotes[currentStep] || null,
          completed,
        }),
      });

      await fetch(`/api/deep-dive/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep: nextStep }),
      });
    } catch (error) {
      console.error("Failed to save step:", error);
    } finally {
      setSaving(false);
    }
  }, [session, currentStep, userNotes, sessionId]);

  const handleNoteChange = useCallback((value: string, stepIdx: number) => {
    setUserNotes((prev) => ({ ...prev, [stepIdx]: value }));
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus("unsaved");
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!session) return;
      const step = session.steps[stepIdx];
      if (!step) return;
      try {
        await fetch(`/api/deep-dive/steps/${step.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userNote: value || null, completed: false }),
        });
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 1000);
  }, [session]);

  const handleNext = async () => {
    const nextStep = currentStep + 1;
    await saveCurrentStep(true, nextStep);

    if (currentStep < (session?.steps?.length || 0) - 1) {
      setCurrentStep(nextStep);
    } else {
      await fetch(`/api/deep-dive/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          currentStep,
          userFinalNote: userNotes[currentStep] || null,
          finalSummary: userNotes[currentStep] || "学習完了",
        }),
      });
      router.push(`/deep-dive/${sessionId}/complete`);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const handleSaveAndClose = async () => {
    await saveCurrentStep(false, currentStep);
    setSaved(true);
    setTimeout(() => router.push("/deep-dives"), 900);
  };

  if (loading || !session) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-4 bg-border-light rounded w-full" />
        <div className="h-24 bg-border-light rounded-2xl" />
        <div className="h-64 bg-border-light rounded-2xl" />
      </div>
    );
  }

  const step = session.steps[currentStep];
  const aiContent = step ? JSON.parse(step.aiContentJson || "{}") : {};
  const isLastStep = currentStep === session.steps.length - 1;
  const isComprehensionCheck = step?.stepKey === "comprehension_check";
  const totalSteps = session.steps.length;

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      {/* Back */}
      <button
        onClick={safeBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        戻る
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-blue-600" />
        </div>
        <h1 className="text-lg font-bold text-text sm:text-xl">厳密学習で学ぶ</h1>
      </div>

      {/* Progress */}
      <StepProgress
        totalSteps={totalSteps}
        currentStep={currentStep}
        steps={session.steps.map((s: { title: string; completed: boolean }) => ({
          title: s.title,
          completed: s.completed,
        }))}
      />

      {/* Mini Post Card */}
      <PostMiniCard post={session.post} />

      {/* Current Step */}
      {step && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-text mb-2">{step.title}</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              先生役のAIがこの投稿を教材化して解説します。下の問いは理解確認です。
            </p>
          </div>

          <AiContentCard content={aiContent} />

          {isComprehensionCheck && aiContent.keyPoints && (
            <div className="bg-blue-50 rounded-2xl p-5 space-y-4">
              <p className="text-sm font-medium text-blue-700">📝 理解チェック</p>
              {aiContent.keyPoints.map((q: string, i: number) => (
                <div key={i}>
                  <p className="text-sm text-text font-medium mb-2">{q}</p>
                  <textarea
                    value={userNotes[currentStep * 100 + i] || ""}
                    onChange={(e) =>
                      setUserNotes((prev) => ({
                        ...prev,
                        [currentStep * 100 + i]: e.target.value,
                      }))
                    }
                    placeholder="あなたの回答を書いてください..."
                    className="w-full rounded-xl border border-blue-200 px-4 py-3 text-sm resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <UserNoteBox
              value={userNotes[currentStep] || ""}
              onChange={(v) => handleNoteChange(v, currentStep)}
              highlighted={isLastStep}
              placeholder={
                isComprehensionCheck
                  ? "理解チェックの感想や追加メモ..."
                  : "理解メモを書く（任意）"
              }
            />
            {autoSaveStatus === "saved" && (
              <p className="mt-1 text-right text-xs text-success">保存しました ✓</p>
            )}
            {autoSaveStatus === "unsaved" && (
              <p className="mt-1 text-right text-xs text-text-muted">未保存…</p>
            )}
          </div>
        </div>
      )}

      {saved && (
        <div className="rounded-xl border border-success/20 bg-success-light px-4 py-2 text-sm text-success text-center">
          進捗を保存しました
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col gap-3 border-t border-border-light pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          前へ
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={handleSaveAndClose}
            disabled={saving}
            loading={saving}
            loadingLabel="保存中..."
          >
            <Save className="w-4 h-4 mr-1" />
            中断して保存
          </Button>
          <Button onClick={handleNext} disabled={saving} loading={saving} loadingLabel="保存中...">
            {isLastStep ? "完了する" : "次へ"}
            {!isLastStep && <ArrowRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
