"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Layers,
  Pencil,
  Sparkles,
  Trash2,
  Wand2,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type OutputKind = "seminar" | "mini_course" | "note" | "newsletter";

const KIND_LABEL: Record<OutputKind, string> = {
  seminar: "セミナー",
  mini_course: "7日メール講座",
  note: "note記事",
  newsletter: "ニュースレター",
};

interface CollectionDetail {
  id: string;
  title: string;
  description: string | null;
  idea: string | null;
  outputJson: string | null;
  items: Array<{
    id: string;
    order: number;
    learningCard: {
      id: string;
      title: string;
      summary: string;
      coreInsight: string;
      sourcePost: {
        id: string;
        classification: { primaryCategory: string } | null;
      };
    };
  }>;
}

interface GeneratedOutput {
  kind: OutputKind;
  generatedAt: string;
  content: {
    title?: string;
    subtitle?: string;
    targetAudience?: string;
    outcomes?: string[];
    outline?: Array<{
      section: string;
      summary: string;
      fromCards?: number[];
      keyPoints?: string[];
      exercise?: string;
    }>;
    body?: string;
    callToAction?: string;
    credits?: string;
  };
}

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = use(params);
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [outputKind, setOutputKind] = useState<OutputKind>("seminar");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIdea, setEditIdea] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/collections/${collectionId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "取得に失敗しました");
          return;
        }
        setCollection(data.collection);
        if (data.collection.outputJson) {
          try {
            setGenerated(JSON.parse(data.collection.outputJson));
          } catch {
            // ignore
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputKind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      setGenerated({
        kind: data.outputKind,
        generatedAt: new Date().toISOString(),
        content: data.content,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const startEdit = () => {
    if (!collection) return;
    setEditTitle(collection.title);
    setEditDescription(collection.description || "");
    setEditIdea(collection.idea || "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditTitle("");
    setEditDescription("");
    setEditIdea("");
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          idea: editIdea.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新に失敗しました");
      setCollection((prev) =>
        prev
          ? {
              ...prev,
              title: data.collection.title,
              description: data.collection.description,
              idea: data.collection.idea,
            }
          : prev
      );
      setEditing(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("このコレクションを削除しますか？")) return;
    try {
      await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
      router.push("/collections");
    } catch (e) {
      console.error(e);
    }
  };

  const copyBody = () => {
    if (generated?.content.body) {
      navigator.clipboard.writeText(generated.content.body);
    }
  };

  if (loading) {
    return <p className="py-12 text-center text-sm text-text-muted">読み込み中…</p>;
  }

  if (!collection) {
    return (
      <Card className="text-center">
        <p className="text-sm text-text">コレクションが見つかりません</p>
        <Link href="/collections" className="mt-3 inline-block">
          <Button variant="secondary" size="sm">一覧へ戻る</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/collections"
          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text"
        >
          <ArrowLeft className="h-3 w-3" />
          コレクション一覧
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          {editing ? (
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-base font-bold text-text focus:border-accent focus:outline-none"
                placeholder="タイトル"
                autoFocus
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full resize-y rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-secondary focus:border-accent focus:outline-none"
                placeholder="説明（任意）"
                rows={2}
              />
              <textarea
                value={editIdea}
                onChange={(e) => setEditIdea(e.target.value)}
                className="w-full resize-y rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-secondary focus:border-accent focus:outline-none"
                placeholder="自分のアイディア・視点（任意）"
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} loading={saving} loadingLabel="保存中...">
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  保存
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <XIcon className="mr-1.5 h-3.5 w-3.5" />
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-xl font-bold text-text sm:text-2xl">
                <Layers className="h-5 w-5 text-accent" />
                {collection.title}
              </h1>
              {collection.description && (
                <p className="mt-1 text-sm text-text-secondary">{collection.description}</p>
              )}
              {collection.idea && (
                <p className="mt-1.5 rounded-lg bg-accent-light/30 px-2.5 py-1.5 text-xs text-text-secondary">
                  <span className="font-semibold text-accent">自分のアイディア: </span>
                  {collection.idea}
                </p>
              )}
            </div>
          )}
          {!editing && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={startEdit}>
                <Pencil className="mr-1.5 h-4 w-4" />
                編集
              </Button>
              <Button variant="ghost" size="sm" onClick={remove}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                削除
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold text-text">AIで束ねる</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABEL) as OutputKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setOutputKind(k)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                outputKind === k
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-white text-text-secondary hover:border-accent/40"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <Button onClick={generate} loading={generating} loadingLabel="生成中... (30-60秒)">
          <Sparkles className="mr-1.5 h-4 w-4" />
          {generated ? "再生成" : "生成する"}
        </Button>
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </Card>

      {generated && (
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-2 py-0.5 text-xs font-medium text-accent">
                {KIND_LABEL[generated.kind]}
              </span>
              <span className="ml-2 text-xs text-text-muted">
                {new Date(generated.generatedAt).toLocaleString("ja-JP")}
              </span>
            </div>
            {generated.content.body && (
              <Button variant="secondary" size="sm" onClick={copyBody}>
                <Copy className="mr-1.5 h-3 w-3" />
                本文をコピー
              </Button>
            )}
          </div>

          {generated.content.title && (
            <div>
              <h3 className="text-lg font-bold text-text">{generated.content.title}</h3>
              {generated.content.subtitle && (
                <p className="mt-1 text-sm text-text-secondary">{generated.content.subtitle}</p>
              )}
            </div>
          )}

          {generated.content.targetAudience && (
            <div className="rounded-xl bg-border-light px-3 py-2 text-xs text-text-secondary">
              <strong className="text-text">対象: </strong>
              {generated.content.targetAudience}
            </div>
          )}

          {generated.content.outcomes && generated.content.outcomes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                受け手が得る成果
              </p>
              <ul className="space-y-1 text-sm text-text">
                {generated.content.outcomes.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {generated.content.outline && generated.content.outline.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                章立て
              </p>
              <div className="space-y-2">
                {generated.content.outline.map((sec, i) => (
                  <div key={i} className="rounded-xl border border-border bg-white p-3">
                    <p className="mb-1 text-sm font-semibold text-text">
                      {i + 1}. {sec.section}
                    </p>
                    <p className="text-xs leading-relaxed text-text-secondary">{sec.summary}</p>
                    {sec.keyPoints && sec.keyPoints.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-text-secondary">
                        {sec.keyPoints.map((p, pi) => (
                          <li key={pi}>・{p}</li>
                        ))}
                      </ul>
                    )}
                    {sec.exercise && (
                      <p className="mt-2 rounded-lg bg-accent-light/40 px-2 py-1 text-xs text-accent">
                        ワーク: {sec.exercise}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {generated.content.body && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                本文
              </p>
              <div className="whitespace-pre-wrap rounded-xl border border-border bg-white p-4 text-sm leading-relaxed text-text">
                {generated.content.body}
              </div>
            </div>
          )}

          {generated.content.callToAction && (
            <div className="rounded-xl border border-accent/30 bg-accent-light/30 p-3">
              <p className="text-xs font-semibold text-accent">行動喚起</p>
              <p className="mt-1 text-sm text-text">{generated.content.callToAction}</p>
            </div>
          )}
        </Card>
      )}

      <Card padding="lg">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-text-secondary" />
          <h2 className="text-sm font-bold text-text">
            含まれる学習カード（{collection.items.length}件）
          </h2>
        </div>
        <div className="space-y-2">
          {collection.items.map((item, i) => (
            <Link
              key={item.id}
              href={`/posts/${item.learningCard.sourcePost.id}/learning`}
              className="block rounded-xl border border-border bg-white p-3 transition-all hover:border-accent/40 hover:bg-accent-light/20"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-muted">{i + 1}.</span>
                    <p className="truncate text-sm font-medium text-text">
                      {item.learningCard.title}
                    </p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
                    {item.learningCard.summary}
                  </p>
                  {item.learningCard.sourcePost.classification?.primaryCategory && (
                    <Badge className="mt-1.5">
                      {item.learningCard.sourcePost.classification.primaryCategory}
                    </Badge>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-text-muted" />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
