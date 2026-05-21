"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Button } from "@/components/ui/Button";
import { PostMiniCard } from "@/components/posts/PostMiniCard";
import { StepProgress } from "@/components/deep-dive/StepProgress";
import { AiContentCard } from "@/components/deep-dive/AiContentCard";
import { UserNoteBox } from "@/components/deep-dive/UserNoteBox";
import { ArrowLeft, ArrowRight, Brain, Save } from "lucide-react";

export default function ThoughtLensPage({ params }: { params: Promise<{ sessionId: string }> }) {
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

        // Load existing notes
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
      // Complete the session
      await fetch(`/api/deep-dive/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          currentStep,
          userFinalNote: userNotes[currentStep] || null,
          finalSummary: userNotes[currentStep] || "深掘り完了",
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
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
          <Brain className="w-5 h-5 text-purple-600" />
        </div>
        <h1 className="text-xl font-bold text-text">思考レンズで深掘る</h1>
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
            <p className="text-sm text-text-secondary leading-relaxed">{step.question}</p>
          </div>

          <AiContentCard content={aiContent} />

          <div className="relative">
            <UserNoteBox
              value={userNotes[currentStep] || ""}
              onChange={(v) => handleNoteChange(v, currentStep)}
              highlighted={isLastStep}
              placeholder={
                isLastStep
                  ? "ここまでの深掘りを踏まえて、自分の言葉でまとめてください..."
                  : "メモを書く（任意）"
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
      <div className="flex items-center justify-between pt-4 border-t border-border-light">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            前へ
          </Button>
        </div>
        <div className="flex gap-2">
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
