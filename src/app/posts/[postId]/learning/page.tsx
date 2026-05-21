"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, LearningStatusBadge } from "@/components/ui/Badge";
import { PostMediaGrid, parsePostMedia } from "@/components/posts/PostMediaGrid";
import { OutputTypeCard } from "@/components/outputs/OutputTypeCard";
import { OutputPreview } from "@/components/outputs/OutputPreview";
import type { LearningOutput } from "@/lib/ai/types";
import { parseArticleContent } from "@/lib/posts/articleContent";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Languages,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  Newspaper,
  Pencil,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";

const PROGRESS_STEPS = [
  "① 記事を読み込み中...",
  "② 構造を抽出中...",
  "③ 手順を生成中...",
  "④ マニュアル化中...",
] as const;

const ARTICLE_PREVIEW_CHARS = 240;

const OUTPUT_TYPES = ["x", "instagram", "note", "markdown_log"] as const;

const tabs = [
  "要約",
  "構造",
  "手順",
  "マニュアル",
  "応用アイデア",
  "図解構成",
  "画像生成プロンプト",
  "自分用メモ",
] as const;

type TabKey = (typeof tabs)[number];

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
      <Icon className="h-5 w-5 text-accent" />
      <h2 className="text-base font-bold text-text">{title}</h2>
    </div>
  );
}

export default function PostLearningPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const router = useRouter();
  const safeBack = useSafeBack();
  const [post, setPost] = useState<PostView | null>(null);
  const [card, setCard] = useState<LearningCardView | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("要約");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoGenerateTriedRef = useRef(false);

  // SNS output state
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<{ title: string; content: string; contentJson?: Record<string, unknown> | null; warning?: string | null } | null>(null);
  const [generatingOutput, setGeneratingOutput] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  // Pseudo-progress state for generation
  const [progressStep, setProgressStep] = useState(0);

  const [articleExpanded, setArticleExpanded] = useState(false);

  const article = useMemo(() => (post ? parseArticleContent(post.urlCardJson) : null), [post]);

  useEffect(() => {
    if (!generating) {
      setProgressStep(0);
      return;
    }
    const interval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [generating]);

  const output = useMemo(() => parseLearningOutput(card), [card]);

  const loadLearning = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/learning`);
      const data = await res.json();
      setPost(data.post || null);
      setCard(data.learningCard || null);
      setMemo(data.learningCard?.userMemo || "");
    } catch (loadError) {
      console.error("Failed to fetch learning card:", loadError);
      setError("学習カードの取得に失敗しました");
    } finally {
      setLoading(false);
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

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/posts/${postId}/learning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "学習カードの生成に失敗しました");
      await loadLearning();
      setMessage("学習カードを作成しました");
    } catch (generateError) {
      console.error("Failed to generate learning card:", generateError);
      setError(generateError instanceof Error ? generateError.message : "学習カードの生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!post) return;
    if (card) return;
    if (generating) return;
    if (autoGenerateTriedRef.current) return;
    autoGenerateTriedRef.current = true;
    handleGenerate();
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
    if (!confirm("この学習カードを削除しますか？削除後はまた「学ぶ」から再生成できます。")) return;
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/learning-cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "学習カードの削除に失敗しました");
      }
      router.push("/knowhow");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "学習カードの削除に失敗しました");
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
        body: JSON.stringify({ outputType: selectedOutput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アウトプットの生成に失敗しました");
      setGeneratedOutput(data);
      if (data.warning) setOutputError(data.warning);
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
        <div className="h-48 rounded-2xl bg-border-light" />
        <div className="h-80 rounded-2xl bg-border-light" />
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold text-text sm:text-2xl">学ぶ：知識資産化</h1>
          </div>
          <p className="text-sm text-text-secondary">
            保存済み投稿を、実践マニュアルと応用メモに変換します。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LearningStatusBadge learningCard={card} />
          {card && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              loading={deleting}
              loadingLabel="削除中..."
              title="学習カードを削除"
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-light">
            {post.authorAvatarUrl ? (
              <img src={post.authorAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-accent" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{post.authorName || "手動追加"}</p>
            <p className="text-xs text-text-muted">
              {post.authorUsername ? `@${post.authorUsername}` : "手動入力"}
              {post.postedAt ? ` ・ ${new Date(post.postedAt).toLocaleDateString("ja-JP")}` : ""}
            </p>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{post.text}</p>
        {post.translatedText && (
          <div className="mt-3 rounded-xl border border-border bg-border-light px-4 py-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-text-secondary">
              <Languages className="h-3.5 w-3.5" />
              日本語訳
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{post.translatedText}</p>
          </div>
        )}
        {/* Article content (pasted by user or auto-fetched). Shown so the user
            can verify the AI is using the same article text they expect. */}
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
                      onClick={() => setArticleExpanded((v) => !v)}
                      className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                    >
                      {articleExpanded ? (
                        <>
                          折りたたむ
                          <ChevronUp className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          全文を見る
                          <ChevronDown className="h-3 w-3" />
                        </>
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
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
          >
            投稿URLを開く
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </Card>

      {!card || !output ? (
        <Card>
          {generating ? (
            <div>
              <h2 className="mb-4 text-base font-bold text-text">学習カードを生成しています…</h2>
              <div className="space-y-3">
                {PROGRESS_STEPS.map((step, i) => (
                  <div
                    key={step}
                    className={`flex items-center gap-3 text-sm ${
                      i < progressStep
                        ? "text-success"
                        : i === progressStep
                        ? "font-medium text-text"
                        : "text-text-muted"
                    }`}
                  >
                    {i < progressStep ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />
                    ) : i === progressStep ? (
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-accent" />
                    ) : (
                      <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-border-light" />
                    )}
                    {step}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-text-muted">平均30秒前後かかります</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="mb-1 text-base font-bold text-text">
                  {error ? "学習カードを生成できませんでした" : "学習カードを準備中…"}
                </h2>
                <p className="text-sm text-text-secondary">
                  {error
                    ? "もう一度試してください。"
                    : "この投稿からノウハウ・手順・マニュアルを自動生成します。"}
                </p>
              </div>
              <Button onClick={handleGenerate} loading={generating} loadingLabel="生成中..." className="w-full sm:w-auto">
                <Sparkles className="mr-1.5 h-4 w-4" />
                {error ? "再生成" : "学ぶ"}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => setActiveTab("画像生成プロンプト")} className="flex-1">
              <ImageIcon className="mr-1.5 h-4 w-4" />
              解説画像を生成
            </Button>
            <Button variant="secondary" onClick={() => setActiveTab("マニュアル")} className="flex-1">
              <FileText className="mr-1.5 h-4 w-4" />
              マニュアルを見る
            </Button>
            <Button onClick={handleSave} loading={saving} loadingLabel="保存中..." className="flex-1">
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              学習カードに保存
            </Button>
          </div>

          {(message || error) && (
            <div
              className={
                error
                  ? "rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger"
                  : "rounded-xl border border-success/20 bg-success-light px-4 py-3 text-sm text-success"
              }
            >
              {error || message}
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto border-b border-border pb-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={
                  activeTab === tab
                    ? "whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-white"
                    : "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-border-light hover:text-text"
                }
              >
                {tab}
              </button>
            ))}
          </div>

          <Card>
            {activeTab === "要約" && (
              <div>
                <SectionHeader icon={Sparkles} title="要約" />
                {output.title && (
                  <p className="mb-4 text-base font-semibold text-text">{output.title}</p>
                )}
                <div className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{output.summary}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-accent-subtle px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-accent">本質</p>
                      <p className="text-sm leading-relaxed text-text">{output.originalIntent}</p>
                    </div>
                    <div className="rounded-xl bg-border-light px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-text-muted">面白さ</p>
                      <p className="text-sm leading-relaxed text-text">{output.whatIsInteresting}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-text">中心洞察</p>
                    <p className="rounded-xl border border-border px-4 py-3 text-sm leading-relaxed text-text">
                      {output.coreInsight}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "構造" && (
              <div>
                <SectionHeader icon={Layers} title="抽出できる構造" />
                <div className="space-y-3">
                  {output.structure.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-sm font-semibold text-text">{item.label}</p>
                      <p className="text-sm leading-relaxed text-text-secondary">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "手順" && (
              <div>
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
              </div>
            )}

            {activeTab === "マニュアル" && (
              <div>
                <SectionHeader icon={FileText} title="実践マニュアル" />
                <p className="whitespace-pre-wrap text-sm leading-7 text-text">{output.manual}</p>
              </div>
            )}

            {activeTab === "応用アイデア" && (
              <div>
                <SectionHeader icon={Lightbulb} title="応用アイデア" />
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

            {activeTab === "図解構成" && (
              <div>
                <SectionHeader icon={ImageIcon} title="図解構成" />
                <div className="space-y-3">
                  {output.diagramStructure.sections.map((section, index) => (
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
              </div>
            )}

            {activeTab === "画像生成プロンプト" && (
              <div>
                <SectionHeader icon={ImageIcon} title="画像生成プロンプト" />
                <div className="mb-4 rounded-xl border border-border bg-border-light px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{output.imageExplanationPrompt}</p>
                </div>
                <Button variant="secondary" onClick={handleCopyPrompt}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  コピー
                </Button>
              </div>
            )}

            {activeTab === "自分用メモ" && (
              <div>
                <SectionHeader icon={Pencil} title="自分用メモ" />
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  className="min-h-[180px] w-full resize-y rounded-xl border border-border px-4 py-3 text-sm leading-relaxed text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="あとで見返すためのメモを書いてください"
                />
                <div className="mt-3 flex gap-2">
                  <Button onClick={handleSave} loading={saving} loadingLabel="保存中...">
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    学習カードに保存
                  </Button>
                  <Button variant="secondary" onClick={handleCopyMemo} disabled={!memo}>
                    <Copy className="mr-1.5 h-4 w-4" />
                    コピー
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* SNS Output section */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h3 className="text-base font-bold text-text">SNS発信コンテンツ</h3>
            </div>
            <p className="mb-4 text-sm text-text-secondary">
              学習内容を発信用コンテンツに変換します。
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
                    setOutputError(null);
                  }}
                />
              ))}
            </div>
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
        </>
      )}
    </div>
  );
}
