"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Badge, LearningStatusBadge } from "@/components/ui/Badge";
import { useConfirm, useAlert } from "@/components/ui/DialogProvider";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import { LearningCardImages } from "@/components/posts/LearningCardImages";
import { LearningCardVideos } from "@/components/posts/LearningCardVideos";
import { OutputTypeCard } from "@/components/outputs/OutputTypeCard";
import { OutputPreview } from "@/components/outputs/OutputPreview";
import { LinkifiedText } from "@/components/ui/LinkifiedText";
import { OpenInXButton } from "@/components/ui/OpenInXButton";
import type { LearningOutput, StrictLearningOutput } from "@/lib/ai/types";
import { parseArticleContent } from "@/lib/posts/articleParser";
import { buildCardCopyText } from "@/lib/export/cardCopyText";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  Film,
  GitBranch,
  GraduationCap,
  Image as ImageIcon,
  Languages,
  Library,
  Lightbulb,
  ListChecks,
  Loader2,
  MoreVertical,
  Newspaper,
  Pencil,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";

const PROGRESS_STEPS = [
  "投稿とツリーの読み込み",
  "中身の忠実な抽出",
  "実践手順の生成",
  "初心者向けの補足",
  "背景・周辺情報の収集",
] as const;

const ARTICLE_PREVIEW_CHARS = 240;

const OUTPUT_TYPES = ["x", "instagram", "short_video", "note", "seminar"] as const;

interface LearningCardView {
  id: string;
  title: string;
  summary: string;
  coreInsight: string;
  manual: string;
  diagramPrompt: string;
  imagePrompt: string;
  outputJson: string;
  userMemo?: string | null;
  status: "draft" | "saved";
  learningMode?: string | null;
  strictLearningJson?: string | null;
}

interface ThreadPostView {
  id: string;
  text: string;
  translatedText?: string | null;
  mediaJson?: string | null;
  threadOrder: number;
}

interface PostView {
  id: string;
  text: string;
  translatedText?: string | null;
  mediaJson?: string | null;
  urlCardJson?: string | null;
  sourceUrl?: string | null;
  authorName?: string | null;
  authorUsername?: string | null;
  authorAvatarUrl?: string | null;
  postedAt?: string | null;
  learningCard?: { id: string; status: string } | null;
  threadPosts?: ThreadPostView[] | null;
}

function parseLearningOutput(card?: LearningCardView | null): LearningOutput | null {
  if (!card?.outputJson) return null;
  try {
    return JSON.parse(card.outputJson) as LearningOutput;
  } catch {
    return null;
  }
}

function SectionHeader({ icon: Icon, title }: { icon: typeof BookOpen; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-5 w-5 text-text-secondary" />
      <h2 className="text-base font-bold text-text">{title}</h2>
    </div>
  );
}

function CollapsibleHeader({
  icon: Icon,
  title,
  open,
  onToggle,
}: {
  icon: typeof BookOpen;
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 text-left"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-text-secondary" />
        <h2 className="text-base font-bold text-text">{title}</h2>
      </div>
      {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
    </button>
  );
}

function LayerDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function PostLearningPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const safeBack = useSafeBack();
  const confirm = useConfirm();
  const alert = useAlert();
  const [post, setPost] = useState<PostView | null>(null);
  const [card, setCard] = useState<LearningCardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoGenerateTriedRef = useRef(false);

  // 生成モデルの上書き（投稿詳細ページで選び、クエリパラメータで渡される。空 = 設定のデフォルト）
  const [genProvider, setGenProvider] = useState("");
  const [genModel, setGenModel] = useState("");
  // 投稿詳細でモデルを明示選択して来た場合は、既存カードがあっても作り直す
  const forceRegenRef = useRef(false);

  const [learningMode, setLearningMode] = useState<"content" | "format">("content");
  const [strictLearning, setStrictLearning] = useState<StrictLearningOutput | null>(null);
  const [strictGenerating, setStrictGenerating] = useState(false);
  const [strictError, setStrictError] = useState<string | null>(null);
  const strictAutoTriedRef = useRef(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // SNS output state
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  const [satoriType, setSatoriType] = useState<"auto" | "A" | "B" | "C" | "D" | "E">("auto");
  const [generatedOutput, setGeneratedOutput] = useState<{ id?: string; title: string; content: string; contentJson?: Record<string, unknown> | null; warning?: string | null } | null>(null);
  const [generatingOutput, setGeneratingOutput] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);

  // Output history
  const [outputHistory, setOutputHistory] = useState<Array<{ id: string; outputType: string; title: string; content: string; contentJson: string | null; createdAt: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  const [articleExpanded, setArticleExpanded] = useState(false);
  const [postExpanded, setPostExpanded] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Collapsible section states (secondary content starts closed)
  const [strictOpen, setStrictOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const article = useMemo(() => (post ? parseArticleContent(post.urlCardJson) : null), [post]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const output = useMemo(() => parseLearningOutput(card), [card]);

  const loadOutputHistory = async (cardId: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/learning-cards/${cardId}/outputs`);
      const data = await res.json();
      setOutputHistory(data.outputs || []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  // 生成履歴から1件削除する。成功したらローカルstateからも除く。
  const handleDeleteOutput = async (outputId: string) => {
    if (!card) return;
    try {
      const res = await fetch(`/api/learning-cards/${card.id}/outputs/${outputId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "生成履歴の削除に失敗しました");
      }
      setOutputHistory((prev) => prev.filter((o) => o.id !== outputId));
    } catch (e) {
      await alert({ title: "削除に失敗しました", message: (e as Error).message });
    }
  };

  // 主要セクション（一言でいうと/投稿の中身/初心者ガイド/背景・周辺情報/本質を絞る/応用アイデア）を
  // 1つのMarkdownにまとめてコピーする。他AIでの記事生成に貼り付ける用途。
  const handleCopyAll = async () => {
    if (!output) return;
    const text = buildCardCopyText(output, strictLearning, {
      title: output.title || card?.title,
      sourceUrl: post?.sourceUrl,
      author: post?.authorUsername ? `@${post.authorUsername}` : post?.authorName,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      await alert({ title: "コピーに失敗しました", message: "クリップボードへのアクセスが拒否されました。" });
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialLearning() {
      try {
        const res = await fetch(`/api/posts/${postId}/learning`);
        const data = await res.json();
        if (cancelled) return;
        setPost(data.post || null);
        setCard(data.learningCard || null);
        setMemo(data.learningCard?.userMemo || "");
        setLearningMode(data.learningCard?.learningMode === "format" ? "format" : "content");
        setStrictLearning(data.strictLearning || null);
        if (data.learningCard?.id) {
          void loadOutputHistory(data.learningCard.id);
        }
      } catch (loadError) {
        console.error("Failed to fetch learning card:", loadError);
        if (!cancelled) setError("学習カードの取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitialLearning();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // 投稿詳細ページで選んだモデルをクエリパラメータから受け取る
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    const model = params.get("model");
    if (provider) {
      setGenProvider(provider);
      // 明示選択して来た = 既存カードがあっても選択モデルで作り直す意図
      forceRegenRef.current = true;
    }
    if (model) setGenModel(model);
    // クエリは消しておく（リロード時に意図せず再生成しないように）
    if (provider || model) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleGenerate = async (mode?: "content" | "format") => {
    const activeMode = mode ?? learningMode;
    if (mode !== undefined) setLearningMode(mode);
    setGenerating(true);
    setError(null);
    setMessage(null);
    setTokenExpired(false);

    try {
      const res = await fetch(`/api/posts/${postId}/learning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learningMode: activeMode,
          ...(genProvider ? { provider: genProvider, model: genModel || undefined } : {}),
        }),
      });
      // タイムアウト等で Vercel が非JSON（プレーンテキスト/HTML）のエラーを返すことがある。
      // res.json() を直接呼ぶと「Unexpected token」で落ちるため、まずテキストで受けてから解析する。
      const rawBody = await res.text();
      let data: { error?: string; code?: string; learningCard?: LearningCardView; strictLearning?: StrictLearningOutput } = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        const snippet = rawBody.trim().slice(0, 200);
        if (res.status === 504 || /timed out|timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(snippet)) {
          throw new Error("生成がタイムアウトしました（処理が5分を超過）。モデルを軽いものに変えるか、時間をおいて再試行してください。");
        }
        throw new Error(`サーバーエラー (HTTP ${res.status}): ${snippet || "応答が空です"}`);
      }
      if (!res.ok) {
        if (data.code === "GROK_TOKEN_EXPIRED") {
          setTokenExpired(true);
        }
        throw new Error(data.error || `学習カードの生成に失敗しました (HTTP ${res.status})`);
      }
      setCard(data.learningCard || null);
      // 厳密学習はこのレスポンスには含まれない（別ルートで生成）。状態をリセットして後追い生成する。
      setStrictLearning(null);
      setStrictError(null);
      strictAutoTriedRef.current = false;
      setMemo(data.learningCard?.userMemo || "");
      if (data.learningCard?.id) {
        void loadOutputHistory(data.learningCard.id);
      }
      setMessage("学習カードを作成しました");
      // 「本質を絞る」(深掘り)はオンデマンド。ユーザーがボタンを押したときだけ生成する。
    } catch (generateError) {
      console.error("Failed to generate learning card:", generateError);
      setError(generateError instanceof Error ? generateError.message : "学習カードの生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const generateStrict = async () => {
    strictAutoTriedRef.current = true;
    setStrictGenerating(true);
    setStrictError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/learning/strict`, { method: "POST" });
      const rawBody = await res.text();
      let data: { error?: string; code?: string; strictLearning?: StrictLearningOutput } = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        const snippet = rawBody.trim().slice(0, 200);
        if (res.status === 504 || /timed out|timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(snippet)) {
          throw new Error("「本質を絞る」の生成がタイムアウトしました（5分超過）。再試行してください。");
        }
        throw new Error(`サーバーエラー (HTTP ${res.status}): ${snippet || "応答が空です"}`);
      }
      if (!res.ok) {
        throw new Error(data.error || `「本質を絞る」の生成に失敗しました (HTTP ${res.status})`);
      }
      setStrictLearning(data.strictLearning || null);
    } catch (strictErr) {
      console.error("Failed to generate strict learning:", strictErr);
      setStrictError(strictErr instanceof Error ? strictErr.message : "「本質を絞る」の生成に失敗しました");
    } finally {
      setStrictGenerating(false);
    }
  };

  const handleModeToggle = async (newMode: "content" | "format") => {
    if (newMode === learningMode) return;
    if (card) {
      const ok = await confirm({
        message: `「${newMode === "content" ? "内容モード" : "型モード"}」に切り替えて再生成しますか？`,
        confirmLabel: "再生成する",
      });
      if (!ok) return;
      void handleGenerate(newMode);
    } else {
      setLearningMode(newMode);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!post) return;
    if (generating) return;
    if (autoGenerateTriedRef.current) return;
    // カードがある場合は通常は再生成しない。
    // ただし投稿詳細でモデルを明示選択して来たときは、その選択モデルで作り直す。
    if (card && !forceRegenRef.current) return;
    autoGenerateTriedRef.current = true;
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, post, card, generating]);

  const handleSave = async () => {
    if (!card) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/learning-cards/${card.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "saved", userMemo: memo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "学習カードの保存に失敗しました");
      setCard(data);
      setMessage("学習カードに保存しました");
    } catch (saveError) {
      console.error("Failed to save learning card:", saveError);
      setError(saveError instanceof Error ? saveError.message : "学習カードの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!output?.imageExplanationPrompt) return;
    try {
      await navigator.clipboard.writeText(output.imageExplanationPrompt);
      setMessage("画像生成プロンプトをコピーしました");
    } catch {
      setMessage("画像生成プロンプトを表示しました");
    }
  };

  const handleCopyMemo = async () => {
    if (!memo) return;
    try {
      await navigator.clipboard.writeText(memo);
      setMessage("メモをコピーしました");
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    const ok = await confirm({
      message: "この学習カードを削除しますか？削除後はそのままこのページで再生成できます。",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/learning-cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "学習カードの削除に失敗しました");
      }
      autoGenerateTriedRef.current = true;
      setCard(null);
      setStrictLearning(null);
      setStrictError(null);
      strictAutoTriedRef.current = false;
      setLearningMode("content");
      setMemo("");
      setSelectedOutput(null);
      setGeneratedOutput(null);
      setOutputHistory([]);
      setMessage("学習カードを削除しました。もう一度「学習する」を押すと再生成できます。");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "学習カードの削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateOutput = async () => {
    if (!card || !selectedOutput) return;
    setGeneratingOutput(true);
    setOutputError(null);
    setGeneratedOutput(null);
    try {
      const res = await fetch(`/api/learning-cards/${card.id}/outputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outputType: selectedOutput,
          ...(selectedOutput === "x" ? { satoriType } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アウトプットの生成に失敗しました");
      setGeneratedOutput(data);
      if (data.warning) setOutputError(data.warning);
      await loadOutputHistory(card.id);
    } catch (genErr) {
      setOutputError(genErr instanceof Error ? genErr.message : "アウトプットの生成に失敗しました");
    } finally {
      setGeneratingOutput(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-5 animate-pulse">
        <div className="h-8 w-48 rounded bg-border-light" />
        <div className="h-48 rounded-xl bg-border-light" />
        <div className="h-80 rounded-xl bg-border-light" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary">投稿が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <button
        onClick={safeBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        戻る
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">学習カード</h1>
          <p className="mt-1 text-sm text-text-secondary">
            保存済み投稿を、実践マニュアルと応用メモに変換します。
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <SegmentedControl
              size="sm"
              value={learningMode}
              onChange={handleModeToggle}
              items={[
                { value: "content", label: "内容" },
                { value: "format", label: "型" },
              ]}
            />
            <LearningStatusBadge learningCard={card} />
            {card && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-border-light hover:text-text"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full z-10 mt-1 rounded-xl border border-border bg-white py-1 shadow-md">
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); void handleDelete(); }}
                      disabled={deleting}
                      className="flex w-full items-center gap-2 whitespace-nowrap px-4 py-2 text-sm text-danger hover:bg-border-light disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 flex-shrink-0" />
                      {deleting ? "削除中..." : "学習カードを削除"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {card && output && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Link href={`/chat?postId=${post.id}`}>
                <Button variant="secondary" size="sm" type="button">
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  AIに聞く
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={handleCopyAll}>
                {copiedAll ? (
                  <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />コピーしました</>
                ) : (
                  <><Copy className="mr-1.5 h-3.5 w-3.5" />記事用にコピー</>
                )}
              </Button>
              <Button size="sm" onClick={handleSave} loading={saving} loadingLabel="保存中...">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                学習カードに保存
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Post card */}
      <Card>
        <button
          type="button"
          onClick={() => setPostExpanded((v) => !v)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-light">
            {post.authorAvatarUrl ? (
              <img src={post.authorAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-accent" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{post.authorName || "手動追加"}</p>
            <p className="text-xs text-text-muted">
              {post.authorUsername ? `@${post.authorUsername}` : "手動入力"}
              {post.postedAt ? ` ・ ${new Date(post.postedAt).toLocaleDateString("ja-JP")}` : ""}
            </p>
          </div>
          {post.threadPosts && post.threadPosts.length > 0 && (
            <Badge variant="success" className="flex-shrink-0 flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              <span>ツリー {post.threadPosts.length + 1}</span>
            </Badge>
          )}
          <span className="flex items-center gap-1 text-xs text-accent">
            {postExpanded ? (
              <>折りたたむ <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>投稿を見る <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </span>
        </button>

        {postExpanded && (
          <div className="mt-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">
              <LinkifiedText text={post.text} />
            </p>
            {post.translatedText && (
              <div className="mt-3 rounded-xl border border-border bg-border-light px-4 py-3">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-text-secondary">
                  <Languages className="h-3.5 w-3.5" />
                  日本語訳
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{post.translatedText}</p>
              </div>
            )}
            {article && (article.pastedContent || article.title || article.description || article.isXArticle) && (
              <div className="mt-3 space-y-2">
                {article.isXArticle && article.expandedUrl && (
                  <a
                    href={article.expandedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-text-secondary transition-colors hover:border-accent/40"
                  >
                    <Newspaper className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
                    <span className="flex-1 truncate">X Article（Xアプリで開く）</span>
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                  </a>
                )}
                {(article.pastedContent || article.title || article.description) && (
                  <div className="rounded-xl border border-border bg-border-light px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                        <Newspaper className="h-3.5 w-3.5 text-accent" />
                        {article.pastedContent ? "記事テキスト（貼り付け済み）" : "記事プレビュー"}
                      </p>
                      {article.pastedContent && article.pastedContent.length > ARTICLE_PREVIEW_CHARS && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setArticleExpanded((v) => !v); }}
                          className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                        >
                          {articleExpanded ? (
                            <>折りたたむ<ChevronUp className="h-3 w-3" /></>
                          ) : (
                            <>全文を見る<ChevronDown className="h-3 w-3" /></>
                          )}
                        </button>
                      )}
                    </div>
                    {article.title && (
                      <p className="mb-1 text-sm font-medium text-text">{article.title}</p>
                    )}
                    {article.pastedContent ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                        {articleExpanded || article.pastedContent.length <= ARTICLE_PREVIEW_CHARS
                          ? article.pastedContent
                          : article.pastedContent.slice(0, ARTICLE_PREVIEW_CHARS) + "…"}
                      </p>
                    ) : article.description ? (
                      <p className="text-sm leading-relaxed text-text-secondary">
                        {article.description}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            <PostMediaGrid media={parsePostMedia(post.mediaJson)} />
            {post.sourceUrl && (
              <div className="mt-4">
                <OpenInXButton href={post.sourceUrl} />
              </div>
            )}

            {/* Thread posts display */}
            {post.threadPosts && post.threadPosts.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                  <GitBranch className="h-3.5 w-3.5 text-accent" />
                  ツリー投稿 ({post.threadPosts.length}件) — 学習に含まれています
                </p>
                <div className="space-y-3">
                  {post.threadPosts.map((tp) => (
                    <div key={tp.id} className="rounded-xl bg-border-light px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-text-muted">{tp.threadOrder + 1}投稿目</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">
                        <LinkifiedText text={tp.text} />
                      </p>
                      {tp.translatedText && (
                        <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm leading-relaxed text-text-secondary">
                          {tp.translatedText}
                        </p>
                      )}
                      <PostMediaGrid media={parsePostMedia(tp.mediaJson)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {!card || !output ? (
        <Card>
          {generating ? (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-accent" />
                <h2 className="text-base font-bold text-text">学習カードを生成しています…</h2>
              </div>
              <p className="mb-3 text-xs font-medium text-text-muted">AIが行う処理</p>
              <div className="space-y-2">
                {PROGRESS_STEPS.map((step) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 text-sm text-text-secondary"
                  >
                    <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-border" />
                    {step}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-text-muted">
                内容量により30秒〜数分かかることがあります。完了までこのままお待ちください。
              </p>
            </div>
          ) : tokenExpired ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-light px-4 py-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-bold text-text">Grok認証の有効期限が切れました</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    ローカルで再認証してからもう一度お試しください。
                  </p>
                </div>
              </div>
              <a
                href="/settings/x"
                className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-light px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                設定画面でGrokを再接続する
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="mb-1 text-base font-bold text-text">
                  {error ? "学習カードを生成できませんでした" : "学習カードを準備中…"}
                </h2>
                {error ? (
                  <>
                    <p className="text-sm text-text-secondary">もう一度試してください。</p>
                    <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-xs text-danger">
                      {error}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-secondary">
                    この投稿からノウハウ・手順・マニュアルを自動生成します。
                  </p>
                )}
              </div>
              <Button onClick={() => void handleGenerate()} loading={generating} loadingLabel="生成中..." className="w-full sm:w-auto">
                <Sparkles className="mr-1.5 h-4 w-4" />
                {error ? "再生成" : "学習する"}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          {generating && (
            <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-light/40 px-4 py-3">
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-accent" />
              <p className="text-sm text-text">
                選択したモデルで学習カードを作り直しています…（内容量により数分かかることがあります）
              </p>
            </div>
          )}
          {!generating && (message || error) && (
            <p className={`text-xs ${error ? "text-danger" : "text-text-muted"}`}>
              {error || message}
            </p>
          )}

          {/* ── Layer 1: まず掴む ── */}
          <LayerDivider label="① まず掴む" />

          {/* 要約（オリエンテーション） */}
          <Card>
            <SectionHeader icon={Sparkles} title="一言でいうと" />
            {output.title && (
              <p className="mb-4 text-base font-semibold text-text">{output.title}</p>
            )}
            <div className="space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{output.summary}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-accent-subtle px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-accent">投稿者の狙い</p>
                  <p className="text-sm leading-relaxed text-text">{output.originalIntent}</p>
                </div>
                {(output.whyForYou || output.whatIsInteresting) && (
                  <div className="rounded-xl bg-border-light px-4 py-3">
                    <p className="mb-1 text-xs font-medium text-text-muted">なぜ見る価値があるか</p>
                    <p className="text-sm leading-relaxed text-text">{output.whyForYou || output.whatIsInteresting}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* ── Layer 2: じっくり理解する ── */}
          <LayerDivider label="② じっくり理解する" />

          {/* ① 投稿の中身そのもの（忠実転写） */}
          {output.capture && ((output.capture.items && output.capture.items.length > 0) || output.capture.verbatim) && (
            <Card>
              <SectionHeader icon={ClipboardList} title="投稿の中身" />
              {output.capture.headline && (
                <p className="mb-4 text-base font-semibold text-text">{output.capture.headline}</p>
              )}
              {output.capture.verbatim ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-border-light px-4 py-3">
                    <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-text">
                      {output.capture.verbatim}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(output.capture!.verbatim || "");
                        setMessage("中身をコピーしました");
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <Copy className="mr-1.5 h-4 w-4" />
                    コピー
                  </Button>
                  {output.capture.usage && (
                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-text-muted">使い方</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{output.capture.usage}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {output.capture.items.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-xl border border-border px-4 py-3">
                      <div className="flex gap-2.5">
                        <span className="flex-shrink-0 text-sm font-bold text-accent">{index + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text">{item.label}</p>
                          <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{item.body}</p>
                          {item.detail && (
                            <p className="mt-1 text-xs leading-relaxed text-text-muted">{item.detail}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ③ 初心者ゾーン */}
          {(() => {
            const zone = output.beginnerZone;
            const stumbling = zone?.stumblingPoints ?? [];
            // 旧カード互換：用語解説は背景情報から拾う
            const glossary = zone?.glossary ?? output.backgroundContext?.terminology ?? [];
            if (stumbling.length === 0 && glossary.length === 0) return null;
            return (
              <Card>
                <SectionHeader icon={GraduationCap} title="初心者ガイド" />
                <div className="space-y-4">
                  {stumbling.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-text">つまずきポイント</p>
                      <div className="space-y-2">
                        {stumbling.map((s, i) => (
                          <div key={`${s.point}-${i}`} className="rounded-xl border border-border px-4 py-3">
                            <p className="mb-1 text-sm font-semibold text-text">{s.point}</p>
                            <p className="text-sm leading-relaxed text-text-secondary">{s.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {glossary.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-text">用語解説</p>
                      <div className="space-y-2">
                        {glossary.map((t, i) => (
                          <div key={`${t.term}-${i}`} className="rounded-xl bg-border-light px-4 py-3">
                            <p className="mb-1 text-sm font-semibold text-text">{t.term}</p>
                            <p className="text-sm leading-relaxed text-text-secondary">{t.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* 周辺情報（background context） */}
          {output.backgroundContext && (() => {
            const bg = output.backgroundContext;
            const hasContent =
              bg.origin ||
              bg.historicalContext ||
              (bg.relatedFrameworks && bg.relatedFrameworks.length > 0) ||
              (bg.referencedWorks && bg.referencedWorks.length > 0) ||
              (bg.furtherReading && bg.furtherReading.length > 0);
            if (!hasContent) return null;
            return (
              <Card>
                <SectionHeader icon={Library} title="背景・周辺情報" />
                {bg.postType && (
                  <p className="mb-4 text-xs text-text-muted">投稿タイプ: {bg.postType}</p>
                )}
                <div className="space-y-4">
                  {bg.origin && (
                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-text-muted">原典・出典</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{bg.origin}</p>
                    </div>
                  )}
                  {bg.historicalContext && (
                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-text-muted">時代背景・文脈</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{bg.historicalContext}</p>
                    </div>
                  )}
                  {bg.relatedFrameworks && bg.relatedFrameworks.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-text">類似フレームワーク・関連する考え方</p>
                      <div className="space-y-2">
                        {bg.relatedFrameworks.map((f, i) => (
                          <div key={`${f.name}-${i}`} className="rounded-xl border border-border px-4 py-3">
                            <p className="mb-1 text-sm font-semibold text-text">{f.name}</p>
                            <p className="mb-1 text-sm leading-relaxed text-text-secondary">{f.description}</p>
                            {f.relation && (
                              <p className="text-xs text-accent">関係: {f.relation}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {bg.referencedWorks && bg.referencedWorks.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-text">投稿で言及されているもの</p>
                      <div className="space-y-2">
                        {bg.referencedWorks.map((w, i) => (
                          <div key={`${w.name}-${i}`} className="rounded-xl bg-border-light px-4 py-3">
                            <p className="mb-1 text-sm font-semibold text-text">{w.name}</p>
                            <p className="text-sm leading-relaxed text-text-secondary">{w.context}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {bg.furtherReading && bg.furtherReading.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-text">もっと知りたい人へ</p>
                      <div className="space-y-2">
                        {bg.furtherReading.map((r, i) => (
                          <div key={`${r.topic}-${i}`} className="rounded-xl border border-border px-4 py-3">
                            <p className="mb-1 text-sm font-semibold text-text">{r.topic}</p>
                            <p className="text-sm leading-relaxed text-text-secondary">{r.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* 手順 */}
          {output.steps && output.steps.length > 0 && (
          <Card>
            <SectionHeader icon={ListChecks} title="実践手順" />
            <div className="space-y-4">
              {output.steps.map((step, index) => (
                <div key={`${step.title}-${index}`} className="rounded-xl border border-border px-4 py-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="learning">{index + 1}</Badge>
                    <p className="text-sm font-semibold text-text">{step.title}</p>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-text-secondary">{step.description}</p>
                  <ul className="space-y-1.5">
                    {step.actions.map((action, actionIndex) => (
                      <li key={`${action}-${actionIndex}`} className="flex gap-2 text-sm text-text">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
          )}

          {/* ── Layer 3: 深める・手を動かす ── */}
          <LayerDivider label="③ 深める・手を動かす" />

          {/* 本質を絞る（オンデマンド深掘り） — collapsible */}
          <Card>
            <CollapsibleHeader
              icon={BookOpen}
              title="本質を絞る"
              open={strictOpen}
              onToggle={() => setStrictOpen((v) => !v)}
            />
            {strictOpen && (
              <div className="mt-4">
                {strictLearning ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-accent-subtle px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-accent">一言でいうと</p>
                      <p className="text-sm font-medium leading-relaxed text-text">{strictLearning.oneLiner}</p>
                    </div>
                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-text-muted">なぜ重要か</p>
                      <p className="text-sm leading-relaxed text-text">{strictLearning.whyItMatters}</p>
                    </div>
                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-text-muted">前提知識</p>
                      <p className="text-sm leading-relaxed text-text">{strictLearning.prerequisites}</p>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-text">主張の分解</p>
                      <div className="space-y-2">
                        {(
                          [
                            ["主張", strictLearning.claimBreakdown.claim],
                            ["背景・文脈", strictLearning.claimBreakdown.background],
                            ["暗黙の前提", strictLearning.claimBreakdown.assumption],
                            ["根拠", strictLearning.claimBreakdown.evidence],
                            ["反例", strictLearning.claimBreakdown.counterExample],
                            ["限界・適用範囲", strictLearning.claimBreakdown.limit],
                          ] as [string, string][]
                        ).map(([label, value]) => (
                          <div key={label} className="rounded-xl border border-border px-4 py-3">
                            <p className="mb-0.5 text-xs font-medium text-text-muted">{label}</p>
                            <p className="text-sm leading-relaxed text-text">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-text">正例・反例で見る</p>
                      <div className="space-y-3">
                        <div className="rounded-xl border border-border px-4 py-3">
                          <p className="mb-2 text-xs font-medium text-success">正例</p>
                          <ul className="space-y-1.5">
                            {strictLearning.strictLearningView.positiveExamples.map((ex, i) => (
                              <li key={i} className="flex gap-2 text-sm text-text">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                                {ex}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-border px-4 py-3">
                          <p className="mb-2 text-xs font-medium text-danger">反例</p>
                          <ul className="space-y-1.5">
                            {strictLearning.strictLearningView.negativeExamples.map((ex, i) => (
                              <li key={i} className="flex gap-2 text-sm text-text-secondary">
                                <span className="mt-0.5 flex-shrink-0 text-danger font-bold">✗</span>
                                {ex}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-border px-4 py-3">
                          <p className="mb-2 text-xs font-medium text-warning">境界事例</p>
                          <ul className="space-y-1.5">
                            {strictLearning.strictLearningView.boundaryExamples.map((ex, i) => (
                              <li key={i} className="flex gap-2 text-sm text-text-secondary">
                                <span className="flex-shrink-0 text-warning">△</span>
                                {ex}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-border px-4 py-3">
                            <p className="mb-2 text-xs font-medium text-text-muted">必要条件</p>
                            <ul className="space-y-1">
                              {strictLearning.strictLearningView.necessaryConditions.map((c, i) => (
                                <li key={i} className="text-sm text-text">・{c}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-border px-4 py-3">
                            <p className="mb-2 text-xs font-medium text-text-muted">典型特徴</p>
                            <ul className="space-y-1">
                              {strictLearning.strictLearningView.typicalFeatures.map((f, i) => (
                                <li key={i} className="text-sm text-text">・{f}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="rounded-xl bg-border-light px-4 py-3">
                          <p className="mb-1 text-xs font-medium text-text-muted">本質</p>
                          <p className="text-sm leading-relaxed text-text">{strictLearning.strictLearningView.essence}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-text-muted">抽象化</p>
                      <p className="text-sm leading-relaxed text-text">{strictLearning.abstraction}</p>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-text">他分野への転用</p>
                      <div className="space-y-2">
                        {strictLearning.transferToOtherFields.map((item, i) => (
                          <div key={i} className="rounded-xl border border-border px-4 py-3">
                            <p className="mb-0.5 text-xs font-medium text-accent">{item.field}</p>
                            <p className="text-sm leading-relaxed text-text">{item.application}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-accent-subtle px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-accent">自分に使うなら</p>
                      <p className="text-sm leading-relaxed text-text">{strictLearning.applyToYourself}</p>
                    </div>
                    <div className="rounded-xl border border-border px-4 py-4">
                      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text">
                        <Clock className="h-4 w-4 text-accent" />
                        15分ワーク
                      </p>
                      <p className="mb-3 text-sm font-medium text-text">ゴール: {strictLearning.fifteenMinuteExercise.goal}</p>
                      <div className="mb-3 space-y-1.5">
                        {strictLearning.fifteenMinuteExercise.steps.map((step, i) => (
                          <div key={i} className="flex gap-2 text-sm text-text">
                            <span className="flex-shrink-0 font-medium text-accent">{i + 1}.</span>
                            {step}
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg bg-success-light px-3 py-2">
                        <p className="mb-0.5 text-xs font-medium text-success">15分後の成果物</p>
                        <p className="text-sm text-text">{strictLearning.fifteenMinuteExercise.deliverable}</p>
                      </div>
                    </div>
                  </div>
                ) : strictGenerating ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    <p className="text-center text-sm text-text-secondary">
                      「本質を絞る」を生成しています…<br />
                      内容量により30秒ほどかかることがあります。
                    </p>
                  </div>
                ) : strictError ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <p className="whitespace-pre-wrap break-words rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-center text-xs text-danger">
                      {strictError}
                    </p>
                    <Button onClick={() => void generateStrict()} loading={strictGenerating} loadingLabel="生成中...">
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      再生成
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <p className="max-w-md text-center text-sm text-text-secondary">
                      この投稿をさらに深く理解したいときに。正例・反例で本質を絞り、抽象化・別分野への転用・15分ワークまで掘り下げます。
                    </p>
                    <Button onClick={() => void generateStrict()} loading={strictGenerating} loadingLabel="生成中...">
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      本質を絞る
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 応用アイデア — collapsible */}
          <Card>
            <CollapsibleHeader
              icon={Lightbulb}
              title="応用アイデア"
              open={applicationOpen}
              onToggle={() => setApplicationOpen((v) => !v)}
            />
            {applicationOpen && (
              <div className="mt-4">
                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  {output.applicationIdeas.map((idea, index) => (
                    <div key={`${idea.title}-${index}`} className="rounded-xl bg-border-light px-4 py-3">
                      <p className="mb-1 text-sm font-semibold text-text">{idea.title}</p>
                      <p className="text-sm leading-relaxed text-text-secondary">{idea.description}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-text">うまく使うコツ</p>
                    <ul className="space-y-1.5">
                      {output.tips.map((tip, index) => (
                        <li key={`${tip}-${index}`} className="text-sm text-text-secondary">・{tip}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-text">向いている用途</p>
                    <div className="flex flex-wrap gap-2">
                      {output.useCases.map((useCase) => (
                        <Badge key={useCase}>{useCase}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* 図解 — collapsible */}
          <Card>
            <CollapsibleHeader
              icon={ImageIcon}
              title="図解構成"
              open={diagramOpen}
              onToggle={() => setDiagramOpen((v) => !v)}
            />
            {diagramOpen && (
              <div className="mt-4">
                <div className="mb-6 space-y-3">
                  {(output.diagramStructure?.sections ?? []).map((section, index) => (
                    <div key={`${section.heading}-${index}`} className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-sm font-semibold text-text">{section.heading}</p>
                      <p className="mb-2 text-sm leading-relaxed text-text-secondary">{section.body}</p>
                      {section.visualIdea && (
                        <p className="rounded-lg bg-accent-subtle px-3 py-2 text-xs text-accent">
                          {section.visualIdea}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <Copy className="h-4 w-4 text-accent" />
                  <p className="text-sm font-bold text-text">画像生成プロンプト</p>
                </div>
                <div className="mb-4 rounded-xl border border-border bg-border-light px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{output.imageExplanationPrompt}</p>
                </div>
                <Button variant="secondary" onClick={handleCopyPrompt}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  コピー
                </Button>
                {card?.id && (
                  <div className="mt-8">
                    <SectionHeader icon={ImageIcon} title="生成画像" />
                    <LearningCardImages
                      cardId={card.id}
                      explanationPrompt={output.imageExplanationPrompt || card.imagePrompt}
                      diagramPrompt={card.diagramPrompt}
                    />
                  </div>
                )}
                {card?.id && (
                  <div className="mt-8">
                    <SectionHeader icon={Film} title="生成動画" />
                    <LearningCardVideos cardId={card.id} />
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 自分用メモ — collapsible */}
          <Card>
            <CollapsibleHeader
              icon={Pencil}
              title="自分用メモ"
              open={memoOpen}
              onToggle={() => setMemoOpen((v) => !v)}
            />
            {memoOpen && (
              <div className="mt-4">
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  className="min-h-[180px] w-full resize-y rounded-lg border border-border px-4 py-3 text-sm leading-relaxed text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="あとで見返すためのメモを書いてください"
                />
                <div className="mt-3 flex gap-2">
                  <Button onClick={handleSave} loading={saving} loadingLabel="保存中...">
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    メモを保存
                  </Button>
                  <Button variant="secondary" onClick={handleCopyMemo} disabled={!memo}>
                    <Copy className="mr-1.5 h-4 w-4" />
                    コピー
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* ── 出すゾーン ── */}
          <div className="flex items-center gap-3 py-2">
            <div className="h-0.5 flex-1 bg-border" />
            <span className="rounded-full bg-border-light px-3 py-1 text-xs font-semibold text-text-secondary">学びを他の人に伝える</span>
            <div className="h-0.5 flex-1 bg-border" />
          </div>

          {/* 発信コンテンツを作る */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-text-secondary" />
              <h3 className="text-base font-bold text-text">発信コンテンツを作る</h3>
            </div>
            <p className="mb-4 text-sm text-text-secondary">
              学んだことを、わかりやすく他の人に伝えるコンテンツに変換します。
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {OUTPUT_TYPES.map((type) => (
                <OutputTypeCard
                  key={type}
                  type={type}
                  selected={selectedOutput === type}
                  onClick={() => {
                    setSelectedOutput(type);
                    setGeneratedOutput(null);
                    setOutputError(null);
                  }}
                />
              ))}
            </div>

            {selectedOutput === "x" && (
              <div className="mb-4 rounded-xl border border-border bg-border-light/40 px-4 py-3">
                <p className="mb-2 text-xs font-medium text-text-secondary">構文の型</p>
                <div className="flex flex-wrap gap-2">
                  {(["auto", "A", "B", "C", "D", "E"] as const).map((t) => {
                    const labels: Record<string, string> = {
                      auto: "自動選択",
                      A: "A・万能",
                      B: "B・逆張り",
                      C: "C・ニュース",
                      D: "D・衝撃",
                      E: "E・ステップ",
                    };
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSatoriType(t)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          satoriType === t
                            ? "bg-accent text-white"
                            : "bg-background border border-border text-text-secondary hover:border-accent/50 hover:text-text"
                        }`}
                      >
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Button
              onClick={handleGenerateOutput}
              disabled={!selectedOutput || generatingOutput}
              loading={generatingOutput}
              loadingLabel="生成中..."
              className="w-full"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              アウトプットを生成
            </Button>
            {outputError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-light p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
                <p className="text-sm text-danger">{outputError}</p>
              </div>
            )}
          </Card>

          {generatedOutput && (
            <OutputPreview
              title={generatedOutput.title}
              content={generatedOutput.content}
              contentJson={generatedOutput.contentJson ?? null}
              outputType={selectedOutput || ""}
            />
          )}

          {/* Output history */}
          {outputHistory.length > 0 && (
            <Card>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-text-muted" />
                  <h3 className="text-base font-bold text-text">生成履歴</h3>
                  <span className="rounded-full bg-border-light px-2 py-0.5 text-xs text-text-secondary">{outputHistory.length}件</span>
                </div>
                {showHistory ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
              </button>

              {showHistory && (
                <div className="mt-4 space-y-3">
                  {historyLoading ? (
                    <div className="animate-pulse space-y-2">
                      {[1, 2].map((i) => <div key={i} className="h-16 bg-border-light rounded-xl" />)}
                    </div>
                  ) : (
                    outputHistory.map((item) => {
                      const typeLabels: Record<string, string> = { x: "X投稿", instagram: "Instagram", short_video: "ショート動画", note: "note", markdown_log: "Markdown", seminar: "セミナー", strict_learning: "本質を絞る" };
                      const parsedJson = item.contentJson ? (() => { try { return JSON.parse(item.contentJson); } catch { return null; } })() : null;
                      return (
                        <OutputPreview
                          key={item.id}
                          title={`${typeLabels[item.outputType] ?? item.outputType} • ${new Date(item.createdAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                          content={item.content}
                          contentJson={parsedJson}
                          outputType={item.outputType}
                          onDelete={() => handleDeleteOutput(item.id)}
                        />
                      );
                    })
                  )}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
