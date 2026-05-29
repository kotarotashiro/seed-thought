"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, SendHorizonal, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { useConfirm } from "@/components/ui/DialogProvider";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "knowhow-chat-history";

const SUGGESTIONS = [
  "保存した中で、LINE導線について書かれていたものを要約して",
  "AI活用カテゴリで最も価値があった3件を教えて",
  "Instagram運用のノウハウだけまとめてセミナーの章立てを作って",
  "私が苦手そうな領域はどこか、傾向から教えて",
];

export default function ChatPage() {
  const confirm = useConfirm();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore history on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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

  const clear = async () => {
    const ok = await confirm({
      message: "会話履歴をすべて削除しますか？",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    setMessages([]);
  };

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col gap-4 sm:h-[calc(100vh-7rem)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text sm:text-2xl">投稿に質問</h1>
            <p className="mt-1 text-xs text-text-secondary">
              保存した投稿をもとに質問できます
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            履歴をクリア
          </Button>
        )}
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden" padding="sm">
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-1 py-2"
        >
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
                    onClick={() => send(s)}
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
            send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send(input);
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
    </div>
  );
}
