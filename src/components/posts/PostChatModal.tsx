"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MarkdownText } from "@/components/ui/MarkdownText";

interface PostInfo {
  id: string;
  text: string;
  authorName?: string | null;
  classification?: { primaryCategory: string } | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function PostChatModal({ post, onClose }: { post: PostInfo; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages, postId: post.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "エラーが発生しました");
      }

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setMessages(newMessages);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col w-full sm:max-w-2xl sm:rounded-2xl bg-white shadow-xl" style={{ height: "min(90dvh, 80vh)", maxHeight: "100dvh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">
              {post.authorName ? `${post.authorName}の投稿` : "投稿"}についてチャット
            </p>
            {post.classification && (
              <p className="text-xs text-text-muted">{post.classification.primaryCategory}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-lg p-1.5 hover:bg-border-light transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Post preview */}
        <div className="border-b border-border px-4 py-3 bg-accent-subtle flex-shrink-0 max-h-[96px] overflow-y-auto">
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-4">{post.text}</p>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4 min-h-0">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-text-muted text-center">この投稿について何でも質問してください</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div key={i} className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                <div
                  className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                    isUser ? "bg-accent" : "bg-purple-100"
                  }`}
                >
                  {isUser ? (
                    <User className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-purple-600" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    isUser
                      ? "bg-accent text-white rounded-tr-sm text-sm leading-relaxed"
                      : "bg-white border border-border text-text rounded-tl-sm"
                  }`}
                >
                  {isUser ? msg.content : <MarkdownText content={msg.content} />}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 flex-shrink-0 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="bg-white border border-border rounded-xl rounded-tl-sm px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />
              </div>
            </div>
          )}
          {error && (
            <div className="bg-danger-light border border-danger/20 rounded-lg p-3 text-xs text-danger">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="質問する... (Cmd+Enter で送信)"
            className="flex-1 resize-none text-sm text-text placeholder:text-text-muted focus:outline-none min-h-[40px] max-h-[100px]"
            rows={1}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
            }}
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
