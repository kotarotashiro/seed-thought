"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PostMiniCard } from "@/components/posts/PostMiniCard";
import { ModeSelectCard } from "@/components/deep-dive/ModeSelectCard";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function ModeSelectPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [post, setPost] = useState<any>(null);
  const [selectedMode, setSelectedMode] = useState<"thought_lens" | "learning_lesson" | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        const data = await res.json();
        setPost(data);
        // Pre-select recommended mode
        if (data.classification?.recommendedMode) {
          setSelectedMode(
            data.classification.recommendedMode === "thought_lens"
              ? "thought_lens"
              : "learning_lesson"
          );
        }
      } catch (error) {
        console.error("Failed to fetch post:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [postId]);

  const handleStart = async () => {
    if (!selectedMode) return;
    setCreating(true);

    try {
      const res = await fetch("/api/deep-dive/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, mode: selectedMode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Session creation failed");
      }

      const session = await res.json();
      const path = selectedMode === "thought_lens" ? "thought" : "learning";
      router.push(`/deep-dive/${session.id}/${path}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      alert(error instanceof Error ? error.message : "セッションの作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-border-light rounded w-64" />
        <div className="h-24 bg-border-light rounded-2xl" />
        <div className="h-40 bg-border-light rounded-2xl" />
        <div className="h-40 bg-border-light rounded-2xl" />
      </div>
    );
  }

  if (!post) {
    return <div className="text-center py-16"><p>投稿が見つかりません</p></div>;
  }

  const recommendedMode = post.classification?.recommendedMode;

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>

      {/* Title */}
      <h1 className="text-xl font-bold text-text sm:text-2xl">この投稿をどう深掘りますか？</h1>

      {/* Mini Post Card */}
      <PostMiniCard post={post} />

      {/* Mode Cards */}
      <div className="space-y-4">
        <ModeSelectCard
          mode="thought_lens"
          selected={selectedMode === "thought_lens"}
          onClick={() => setSelectedMode("thought_lens")}
          recommended={recommendedMode === "thought_lens"}
        />
        <ModeSelectCard
          mode="learning_lesson"
          selected={selectedMode === "learning_lesson"}
          onClick={() => setSelectedMode("learning_lesson")}
          recommended={recommendedMode === "learning_lesson"}
        />
      </div>

      {/* AI Recommendation */}
      {post.classification?.recommendReason && (
        <Card className="bg-accent-subtle border-accent/10">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-accent mb-1">
                AIのおすすめ：{recommendedMode === "thought_lens" ? "思考レンズ" : "学習レッスン"}
              </p>
              <p className="text-sm text-text-secondary">
                {post.classification.recommendReason}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          onClick={() => router.push("/")}
          className="flex-1"
        >
          投稿を選び直す
        </Button>
        <Button
          onClick={handleStart}
          disabled={!selectedMode || creating}
          loading={creating}
          loadingLabel="作成中..."
          className="flex-1"
        >
          このモードで進む
        </Button>
      </div>
    </div>
  );
}
