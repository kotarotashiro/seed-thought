"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { PenSquare } from "lucide-react";

export default function NewPostPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [genre, setGenre] = useState("");
  const [postType, setPostType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (andDeepDive: boolean = false) => {
    if (!text.trim()) {
      setError("投稿本文を入力してください");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          genre: genre || undefined,
          postType: postType || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "保存に失敗しました");
        return;
      }

      const post = await res.json();

      if (andDeepDive) {
        router.push(`/posts/${post.id}/confirm`);
      } else {
        router.push("/posts");
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <PenSquare className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">投稿を追加</h1>
          <p className="text-sm text-text-secondary">
            深掘りしたい投稿を手動で追加できます
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <div className="space-y-5">
          <Textarea
            label="投稿本文"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="深掘りしたい投稿の内容を貼り付けるか、入力してください..."
            error={error}
            className="min-h-[160px]"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="投稿タイプ（任意）"
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              options={[
                { value: "", label: "AIに任せる" },
                { value: "thought", label: "思考系" },
                { value: "learning", label: "学習系" },
                { value: "output_material", label: "発信素材系" },
              ]}
            />

            <Select
              label="ジャンル（任意）"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              options={[
                { value: "", label: "AIに任せる" },
                { value: "AI活用", label: "AI活用" },
                { value: "SNS運用", label: "SNS運用" },
                { value: "マーケティング", label: "マーケティング" },
                { value: "コンテンツ制作", label: "コンテンツ制作" },
                { value: "LINE運用", label: "LINE運用" },
                { value: "セミナー集客", label: "セミナー集客" },
              ]}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => handleSave(false)}
              disabled={saving}
              variant="secondary"
              className="flex-1"
            >
              {saving ? "保存中..." : "保存する"}
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1"
            >
              {saving ? "保存中..." : "保存して深掘りする"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
