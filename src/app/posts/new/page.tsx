"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Globe, Image as ImageIcon, Loader2, Mic, PenSquare, Square, Upload, Video } from "lucide-react";

type Tab = "text" | "article" | "youtube" | "voice" | "image";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function NewPostPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [genre, setGenre] = useState("");
  const [postType, setPostType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Voice tab — Web Speech API (browser native, no API call)
  const [recording, setRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const interimRef = useRef("");

  useEffect(() => {
    setVoiceSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  // Image tab — Grok Vision (server-side)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Article tab
  const [articleUrl, setArticleUrl] = useState("");
  const [articleFetching, setArticleFetching] = useState(false);

  // YouTube tab
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeFetching, setYoutubeFetching] = useState(false);

  // テキストタブ: 保存
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

  // 記事URL: 取り込み
  const handleArticleSave = async (andLearn: boolean = false) => {
    if (!articleUrl.trim()) {
      setError("URLを入力してください");
      return;
    }
    if (!/^https?:\/\/.+/.test(articleUrl.trim())) {
      setError("有効なURLを入力してください（https://... の形式）");
      return;
    }
    setArticleFetching(true);
    setError("");
    try {
      const res = await fetch("/api/posts/from-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: articleUrl.trim(), andLearn }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "記事の取り込みに失敗しました");
        return;
      }
      if (andLearn && data.postId) {
        router.push(`/posts/${data.postId}/confirm`);
      } else {
        router.push("/posts");
      }
    } catch {
      setError("記事の取り込みに失敗しました");
    } finally {
      setArticleFetching(false);
    }
  };

  // YouTube URL: 取り込み
  const handleYoutubeSave = async (andLearn: boolean = false) => {
    if (!youtubeUrl.trim()) {
      setError("YouTubeのURLを入力してください");
      return;
    }
    setYoutubeFetching(true);
    setError("");
    try {
      const res = await fetch("/api/posts/from-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl.trim(), andLearn }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "YouTube動画の取り込みに失敗しました");
        return;
      }
      if (andLearn && data.postId) {
        router.push(`/posts/${data.postId}/confirm`);
      } else {
        router.push("/posts");
      }
    } catch {
      setError("YouTube動画の取り込みに失敗しました");
    } finally {
      setYoutubeFetching(false);
    }
  };

  // 音声: 録音
  const startRecording = () => {
    setError("");
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("このブラウザは音声認識に対応していません（Chrome 推奨）");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;
    interimRef.current = text;

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalChunk += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (finalChunk) {
        interimRef.current = `${interimRef.current}${finalChunk}`;
        setText(interimRef.current);
      } else if (interim) {
        setText(`${interimRef.current}${interim}`);
      }
    };

    recognition.onerror = () => {
      setError("音声認識中にエラーが発生しました");
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
    setTab("text");
  };

  // 画像解析
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

  const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: "text",    label: "テキスト", icon: <PenSquare className="w-4 h-4" /> },
    { value: "article", label: "記事URL",  icon: <Globe className="w-4 h-4" /> },
    { value: "youtube", label: "YouTube",  icon: <Video className="w-4 h-4" /> },
    { value: "voice",   label: "音声メモ", icon: <Mic className="w-4 h-4" /> },
    { value: "image",   label: "画像解析", icon: <ImageIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">投稿を追加</h1>
        <p className="mt-1 text-sm text-text-secondary">テキスト・記事URL・YouTube・音声・画像から取り込めます</p>
      </div>

      <SegmentedControl
        fullWidth
        collapseLabelsOnMobile
        value={tab}
        onChange={setTab}
        items={TABS}
      />

      <Card>
        {/* テキスト */}
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
              <Button onClick={() => handleSave(false)} disabled={saving} loading={saving} loadingLabel="保存中..." variant="secondary" className="flex-1">
                保存する
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} loading={saving} loadingLabel="保存中..." className="flex-1">
                保存して学ぶ
              </Button>
            </div>
          </div>
        )}

        {/* 記事URL */}
        {tab === "article" && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">記事のURL</label>
              <input
                type="url"
                value={articleUrl}
                onChange={(e) => setArticleUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
            </div>
            <div className="rounded-xl bg-border-light/50 p-3 text-xs text-text-secondary space-y-1">
              <p>・ 記事のHTMLから本文を自動抽出して学習カード化します</p>
              <p>・ ブログ・ニュース・note などのURL に対応</p>
              <p>・ ログインが必要なページや有料記事は取得できない場合があります</p>
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                onClick={() => handleArticleSave(false)}
                disabled={articleFetching}
                loading={articleFetching}
                loadingLabel="取り込み中..."
                variant="secondary"
                className="flex-1"
              >
                {articleFetching ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />取り込み中...</> : "保存する"}
              </Button>
              <Button
                onClick={() => handleArticleSave(true)}
                disabled={articleFetching}
                loading={articleFetching}
                loadingLabel="取り込み中..."
                className="flex-1"
              >
                保存して学ぶ
              </Button>
            </div>
          </div>
        )}

        {/* YouTube */}
        {tab === "youtube" && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">YouTubeのURL</label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
            </div>
            <div className="rounded-xl bg-border-light/50 p-3 text-xs text-text-secondary space-y-1">
              <p>・ 動画の字幕（自動生成・手動字幕）をテキストとして取り込みます</p>
              <p>・ 無料処理のため、字幕のない動画は取り込めません</p>
              <p>・ 日本語字幕 → 英語字幕 の順で優先して取得します</p>
              <p>・ youtu.be / youtube.com/shorts のURLにも対応</p>
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                onClick={() => handleYoutubeSave(false)}
                disabled={youtubeFetching}
                loading={youtubeFetching}
                loadingLabel="取り込み中..."
                variant="secondary"
                className="flex-1"
              >
                保存する
              </Button>
              <Button
                onClick={() => handleYoutubeSave(true)}
                disabled={youtubeFetching}
                loading={youtubeFetching}
                loadingLabel="取り込み中..."
                className="flex-1"
              >
                保存して学ぶ
              </Button>
            </div>
          </div>
        )}

        {/* 音声メモ */}
        {tab === "voice" && (
          <div className="space-y-5 text-center">
            <p className="text-sm text-text-secondary">
              録音ボタンを押してメモを話しかけてください。<br />
              ブラウザの音声認識（無料・ローカル）で文字起こしします。
            </p>
            {!voiceSupported && (
              <p className="text-sm text-danger">
                このブラウザは音声認識に対応していません。Chrome / Edge / Safari でお試しください。
              </p>
            )}
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
                  disabled={!voiceSupported}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full bg-accent text-white shadow-lg transition-all hover:bg-accent/90 active:scale-95 disabled:opacity-50"
                >
                  <Mic className="h-6 w-6" />
                  <span className="text-xs">録音</span>
                </button>
              )}
            </div>
            {recording && <p className="animate-pulse text-sm text-danger">● 録音中... 話し終わったら停止</p>}
            {text && (
              <div className="rounded-xl border border-border bg-white p-4 text-left">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">認識中の文字起こし</p>
                <p className="whitespace-pre-wrap text-sm text-text">{text}</p>
              </div>
            )}
          </div>
        )}

        {/* 画像解析 */}
        {tab === "image" && (
          <div className="space-y-5">
            <p className="text-sm text-text-secondary">
              スクリーンショットや資料の写真をアップロードすると、<br />
              AIが画像の内容を解析して投稿本文に転写します。
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
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-10 transition-colors hover:border-accent hover:bg-accent-light/30"
            >
              <Upload className="h-8 w-8 text-text-muted" />
              <p className="text-sm font-medium text-text-secondary">
                {imageFile ? imageFile.name : "クリックして画像を選択"}
              </p>
              {analyzing && <p className="animate-pulse text-sm text-accent">解析中...</p>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
