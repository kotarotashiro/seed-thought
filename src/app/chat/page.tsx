"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookmarkPlus,
  Clock,
  ExternalLink,
  Globe,
  MessageSquare,
  Search,
  SendHorizonal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge, PostTypeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { useConfirm } from "@/components/ui/DialogProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "chat" | "search" | "research";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SearchResultItem {
  postId: string;
  relevanceScore: number;
  reason: string;
  post: {
    id: string;
    text: string;
    sourceUrl?: string | null;
    authorName?: string | null;
    authorUsername?: string | null;
    classification?: {
      primaryCategory: string;
      postType: string;
      summary: string;
    } | null;
  };
}

type ResearchMode = "quick" | "deep";

interface ResearchHistoryItem {
  id: string;
  query: string;
  mode: string;
  createdAt: string;
}

interface ResearchResult {
  id: string;
  query: string;
  mode: ResearchMode;
  answer: string;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHAT_STORAGE_KEY = "knowhow-chat-history";
const SEARCH_HISTORY_KEY = "knowhow-search-history";
const MAX_HISTORY = 8;

const SUGGESTIONS = [
  "保存した中で、LINE導線について書かれていたものを要約して",
  "AI活用カテゴリで最も価値があった3件を教えて",
  "Instagram運用のノウハウだけまとめてセミナーの章立てを作って",
  "私が苦手そうな領域はどこか、傾向から教えて",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSearchHistory(query: string, current: string[]): string[] {
  const next = [query, ...current.filter((q) => q !== query)].slice(0, MAX_HISTORY);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AskAIPage() {
  const confirm = useConfirm();

  // Mode — read ?mode=search from URL on first render
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "chat";
    return new URLSearchParams(window.location.search).get("mode") === "search"
      ? "search"
      : "chat";
  });

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Search state ─────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory);

  // ── Research state ────────────────────────────────────────────────────────────
  const [researchQuery, setResearchQuery] = useState("");
  const [researchMode, setResearchMode] = useState<ResearchMode>("quick");
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [researchHistory, setResearchHistory] = useState<ResearchHistoryItem[]>([]);
  const [researchHistoryLoaded, setResearchHistoryLoaded] = useState(false);
  const [cardifying, setCardifying] = useState(false);

  // ── Chat effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // ── Chat handlers ─────────────────────────────────────────────────────────────

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "チャットに失敗しました");
      setMessages([...next, { role: "assistant", content: data.reply || "" }]);
    } catch (error) {
      console.error("Chat failed:", error);
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `エラーが発生しました: ${(error as Error).message}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    const ok = await confirm({
      message: "会話履歴をすべて削除しますか？",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    setMessages([]);
  };

  // ── Search handlers ───────────────────────────────────────────────────────────

  const handleSearch = async (q?: string) => {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery) return;
    setQuery(searchQuery);
    setSearchLoading(true);
    setSearchError("");
    setSearched(false);

    try {
      const res = await fetch("/api/search/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "検索に失敗しました");
      }
      const data = await res.json();
      setResults(data.results || []);
      setSearched(true);
      setSearchHistory(saveSearchHistory(searchQuery, searchHistory));
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "検索に失敗しました");
    } finally {
      setSearchLoading(false);
    }
  };

  const removeSearchHistory = (q: string) => {
    const next = searchHistory.filter((h) => h !== q);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    setSearchHistory(next);
  };

  // ── Research handlers ─────────────────────────────────────────────────────────

  const loadResearchHistory = async () => {
    if (researchHistoryLoaded) return;
    try {
      const res = await fetch("/api/research");
      if (res.ok) {
        const data = await res.json() as { history: ResearchHistoryItem[] };
        setResearchHistory(data.history ?? []);
      }
    } catch {
      // ignore
    }
    setResearchHistoryLoaded(true);
  };

  const handleResearch = async (q?: string, modeOverride?: ResearchMode) => {
    const rq = (q ?? researchQuery).trim();
    if (!rq) return;
    const mode = modeOverride ?? researchMode;
    setResearchQuery(rq);
    setResearchLoading(true);
    setResearchError("");
    setResearchResult(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: rq, mode }),
      });
      const data = await res.json() as ResearchResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "リサーチに失敗しました");
      setResearchResult(data);
      setResearchHistory((prev) => [{ id: data.id, query: data.query, mode: data.mode, createdAt: data.createdAt }, ...prev]);
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : "リサーチに失敗しました");
    } finally {
      setResearchLoading(false);
    }
  };

  const handleCardify = async () => {
    if (!researchResult) return;
    setCardifying(true);
    try {
      const res = await fetch(`/api/research/${researchResult.id}/cardify`, { method: "POST" });
      const data = await res.json() as { postId?: string; error?: string };
      if (!res.ok || !data.postId) throw new Error(data.error || "カード化に失敗しました");
      window.location.href = `/posts/${data.postId}/confirm`;
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : "カード化に失敗しました");
      setCardifying(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className={
        mode === "chat"
          ? "flex h-[calc(100dvh-9rem)] flex-col gap-4 sm:h-[calc(100vh-7rem)]"
          : "space-y-6"
      }
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text sm:text-2xl">AIに聞く</h1>
            <p className="mt-1 text-xs text-text-secondary">
              {mode === "chat"
                ? "保存した投稿をもとに質問できます"
                : mode === "search"
                ? "悩みや目標を入力して関連メモを探す"
                : "X・ウェブをライブ検索して知見をまとめる"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === "chat" && messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              履歴をクリア
            </Button>
          )}
          {/* Mode tabs */}
          <SegmentedControl
            size="sm"
            value={mode}
            onChange={(next) => {
              setMode(next);
              if (next === "research") void loadResearchHistory();
            }}
            items={[
              { value: "chat", label: "質問", icon: <MessageSquare className="h-3.5 w-3.5" /> },
              { value: "search", label: "検索", icon: <Search className="h-3.5 w-3.5" /> },
              { value: "research", label: "リサーチ", icon: <Globe className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>
      </div>

      {/* ── Chat mode ──────────────────────────────────────────────────────────── */}
      {mode === "chat" && (
        <Card className="flex flex-1 flex-col overflow-hidden" padding="sm">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 py-2">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <p className="text-sm font-semibold text-text">
                  保存した投稿に質問してみましょう
                </p>
                <p className="mt-1 max-w-md text-xs text-text-secondary">
                  直近30件の保存投稿を参考に、AIが回答します。出典の投稿番号付きで返ってきます。
                </p>
                <div className="mt-5 grid w-full max-w-lg gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-left text-sm text-text-secondary hover:border-accent/40 hover:bg-accent-light/30 hover:text-text"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-sm text-white"
                      : "max-w-[85%] rounded-2xl rounded-tl-md bg-border-light px-4 py-3 text-sm text-text"
                  }
                >
                  {m.role === "assistant" ? (
                    <MarkdownText content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              ))
            )}
            {sending && (
              <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-border-light px-4 py-3 text-sm text-text-secondary">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" />
                  考え中…
                </span>
              </div>
            )}
          </div>

          <form
            className="mt-3 flex items-end gap-2 border-t border-border-light pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="保存した投稿に質問する… (Ctrl/Cmd + Enter で送信)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <Button
              type="submit"
              disabled={!input.trim() || sending}
              loading={sending}
              loadingLabel="送信中"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      )}

      {/* ── Search mode ────────────────────────────────────────────────────────── */}
      {mode === "search" && (
        <>
          <div className="space-y-3 rounded-2xl border border-border bg-white p-5">
            <div className="mb-1 flex items-center gap-2 text-sm text-text-secondary">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>AIがあなたの悩みに合った投稿を見つけます</span>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSearch();
              }}
              placeholder={"例: SNSのフォロワーを増やすには？\n例: 文章を読みやすくするコツが知りたい"}
              className="w-full min-h-[100px] resize-none rounded-xl border border-border px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Cmd+Enter で検索</span>
              <Button
                onClick={() => void handleSearch()}
                loading={searchLoading}
                loadingLabel="検索中..."
              >
                <Search className="mr-1.5 h-4 w-4" />
                検索する
              </Button>
            </div>
          </div>

          {searchHistory.length > 0 && !searched && (
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-xs font-medium text-text-muted">
                <Clock className="h-3.5 w-3.5" />
                検索履歴
              </p>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((q) => (
                  <div
                    key={q}
                    className="group flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1"
                  >
                    <button
                      onClick={() => void handleSearch(q)}
                      className="max-w-[200px] truncate text-xs text-text-secondary hover:text-text"
                    >
                      {q}
                    </button>
                    <button
                      onClick={() => removeSearchHistory(q)}
                      className="text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {searchError}
            </div>
          )}

          {searched && results.length === 0 && (
            <div className="rounded-2xl border border-border bg-white py-12 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-text-muted" />
              <p className="text-sm text-text-secondary">該当するメモが見つかりませんでした</p>
              <p className="mt-1 text-xs text-text-muted">別のキーワードやフレーズで試してみてください</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">{results.length}件の関連メモが見つかりました</p>
              {results.map((item) => (
                <Card key={item.postId} hoverable className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {item.post.classification && (
                        <>
                          <PostTypeBadge type={item.post.classification.postType} />
                          <Badge>{item.post.classification.primaryCategory}</Badge>
                        </>
                      )}
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600">
                        関連度 {item.relevanceScore}%
                      </span>
                    </div>
                    {item.post.sourceUrl && (
                      <a
                        href={item.post.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0"
                      >
                        <ExternalLink className="h-4 w-4 text-text-muted hover:text-text" />
                      </a>
                    )}
                  </div>

                  <p className="line-clamp-3 text-sm leading-relaxed text-text">
                    {item.post.classification?.summary || item.post.text}
                  </p>

                  <div className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700">
                    <span className="font-medium">関連理由: </span>
                    {item.reason}
                  </div>

                  {item.post.authorUsername && (
                    <p className="text-xs text-text-muted">@{item.post.authorUsername}</p>
                  )}

                  <div className="mt-auto">
                    <Link href={`/posts/${item.postId}/confirm`}>
                      <Button size="sm" className="w-full">
                        深掘る
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Research mode ───────────────────────────────────────────────────────── */}
      {mode === "research" && (
        <>
          <div className="space-y-3 rounded-2xl border border-border bg-white p-5">
            <div className="mb-1 flex items-center gap-2 text-sm text-text-secondary">
              <Globe className="h-4 w-4 text-blue-500" />
              <span>X・ウェブをリアルタイム検索して知見をまとめます</span>
            </div>
            <textarea
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleResearch();
              }}
              placeholder={"例: AIエージェントの最新動向\n例: Xのアルゴリズム変化と発信戦略"}
              className="w-full min-h-[100px] resize-none rounded-xl border border-border px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              rows={3}
            />
            {/* Mode toggle: 通常 / 深掘り */}
            <SegmentedControl
              size="sm"
              fullWidth
              value={researchMode}
              onChange={setResearchMode}
              items={[
                { value: "quick", label: "通常（1回検索・速い）" },
                { value: "deep", label: "深掘り（複数観点・詳しい）" },
              ]}
            />
            {researchMode === "deep" && (
              <p className="text-xs text-amber-600">
                テーマを複数の観点に分解して並列で調べ、統合レポートを作ります。時間と検索回数（コスト）が通常より増えます（目安: 30〜60秒）。
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Cmd+Enter でリサーチ開始</span>
              <Button
                onClick={() => void handleResearch()}
                loading={researchLoading}
                loadingLabel={researchMode === "deep" ? "深掘り中…" : "リサーチ中…"}
                disabled={!researchQuery.trim()}
              >
                <Globe className="mr-1.5 h-4 w-4" />
                {researchMode === "deep" ? "深掘りリサーチ" : "リサーチする"}
              </Button>
            </div>
          </div>

          {researchError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {researchError}
            </div>
          )}

          {researchResult && (
            <Card className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {researchResult.mode === "deep" && <Badge variant="success">深掘り</Badge>}
                  <p className="text-sm font-semibold text-text">{researchResult.query}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleCardify()}
                  disabled={cardifying}
                  loading={cardifying}
                  loadingLabel="カード化中…"
                >
                  <BookmarkPlus className="mr-1.5 h-4 w-4" />
                  カード化
                </Button>
              </div>
              <div className="border-t border-border pt-4">
                <MarkdownText content={researchResult.answer} />
              </div>
            </Card>
          )}

          {!researchResult && researchHistory.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-xs font-medium text-text-muted">
                <Clock className="h-3.5 w-3.5" />
                リサーチ履歴
              </p>
              <div className="flex flex-wrap gap-2">
                {researchHistory.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => void handleResearch(h.query, h.mode === "deep" ? "deep" : "quick")}
                    className="flex max-w-[280px] items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs text-text-secondary hover:border-accent/40 hover:text-text"
                  >
                    {h.mode === "deep" && <span className="text-[10px] font-semibold text-emerald-600">深</span>}
                    <span className="truncate">{h.query}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
