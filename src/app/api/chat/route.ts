import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { ChatMessage } from "@/lib/ai/types";

// LLM呼び出しを伴う。Vercel Hobby(Fluid Compute)上限の300秒まで引き上げ、
// Kimi等の遅いモデルでも打ち切られないようにする。
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [], postId } = body as {
      message: string;
      history: ChatMessage[];
      postId?: string;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
    }

    // If a specific postId is given, fetch it first so it leads the context
    const focusPost = postId
      ? await prisma.post.findUnique({
          where: { id: postId },
          include: { classification: true },
        })
      : null;

    const posts = await prisma.post.findMany({
      where: {
        classification: { isNot: null },
        ...(postId ? { id: { not: postId } } : {}),
      },
      include: { classification: true },
      orderBy: { savedAt: "desc" },
      take: 30,
    });

    type PostWithClassification = (typeof posts)[0];
    const toContext = (p: PostWithClassification) => ({
      id: p.id,
      text: p.text,
      summary: p.classification?.summary,
      primaryCategory: p.classification?.primaryCategory,
      tags: p.classification ? (JSON.parse(p.classification.tagsJson || "[]") as string[]) : [],
      sourceUrl: p.sourceUrl,
      authorUsername: p.authorUsername,
    });

    const postContexts = [
      ...(focusPost ? [toContext(focusPost)] : []),
      ...posts.map(toContext),
    ];

    const reply = await getAiProvider().chat(message.trim(), history, postContexts);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat failed:", error);
    return NextResponse.json({ error: "チャットに失敗しました" }, { status: 500 });
  }
}
