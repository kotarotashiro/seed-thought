"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Image as ImageIcon, Mic, PenSquare, Square, Upload } from "lucide-react";

type Tab = "text" | "voice" | "image";

export default function NewPostPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [genre, setGenre] = useState("");
  const [postType, setPostType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Voice tab
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Image tab
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = async (andLearn: boolean = false) => {
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

      if (andLearn) {
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

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("マイクのアクセスが許可されていません");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "audio.webm");
      const res = await fetch("/api/posts/from-audio", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "音声認識に失敗しました");
        return;
      }
      const { text: transcript } = await res.json();
      setText(transcript);
      setTab("text");
    } catch {
      setError("音声認識に失敗しました");
    } finally {
      setTranscribing(false);
    }
  };

  const analyzeImage = async (file: File) => {
    setAnalyzing(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/posts/from-image", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "画像解析に失敗しました");
        return;
      }
      const { text: extracted } = await res.json();
      setText(extracted);
      setTab("text");
    } catch {
      setError("画像解析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    analyzeImage(file);
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "text", label: "テキスト", icon: <PenSquare className="w-4 h-4" /> },
    { id: "voice", label: "音声メモ", icon: <Mic className="w-4 h-4" /> },
    { id: "image", label: "画像解析", icon: <ImageIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <PenSquare className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">投稿を追加</h1>
          <p className="text-sm text-text-secondary">学びにしたい投稿を手動で追加できます</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-border-light p-1">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
              tab === id
                ? "bg-white text-text shadow-sm"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <Card>
        {tab === "text" && (
          <div className="space-y-5">
            <Textarea
              label="投稿本文"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="学びにしたい投稿の内容を貼り付けるか、入力してください..."
              error={error}
              className="min-h-[160px]"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                onClick={() => handleSave(false)}
                disabled={saving}
                loading={saving}
                loadingLabel="保存中..."
                variant="secondary"
                className="flex-1"
              >
                保存する
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={saving}
                loading={saving}
                loadingLabel="保存中..."
                className="flex-1"
              >
                保存して学ぶ
              </Button>
            </div>
          </div>
        )}

        {tab === "voice" && (
          <div className="space-y-5 text-center">
            <p className="text-sm text-text-secondary">
              録音ボタンを押してメモを話しかけてください。<br />
              Grok で文字起こしして投稿本文に転写します。
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-center">
              {recording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full bg-danger text-white shadow-lg transition-all hover:bg-danger/90 active:scale-95"
                >
                  <Square className="h-6 w-6 fill-white" />
                  <span className="text-xs">停止</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={transcribing}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full bg-accent text-white shadow-lg transition-all hover:bg-accent/90 active:scale-95 disabled:opacity-50"
                >
                  <Mic className="h-6 w-6" />
                  <span className="text-xs">{transcribing ? "変換中..." : "録音"}</span>
                </button>
              )}
            </div>
            {recording && (
              <p className="animate-pulse text-sm text-danger">● 録音中...</p>
            )}
          </div>
        )}

        {tab === "image" && (
          <div className="space-y-5">
            <p className="text-sm text-text-secondary">
              スクリーンショットや資料の写真をアップロードすると、<br />
              Grok Vision が内容を解析して投稿本文に転写します。
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-10 transition-colors hover:border-accent hover:bg-accent-light/30"
            >
              <Upload className="h-8 w-8 text-text-muted" />
              <p className="text-sm font-medium text-text-secondary">
                {imageFile ? imageFile.name : "クリックして画像を選択"}
              </p>
              {analyzing && (
                <p className="animate-pulse text-sm text-accent">解析中...</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
