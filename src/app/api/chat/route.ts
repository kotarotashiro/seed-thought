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

    // フォーカス投稿（カード経由で会話に入った場合）を最優先で文脈に入れる
    const focusPost = postId
      ? await prisma.post.findUnique({
          where: { id: postId },
          include: {
            classification: true,
            learningCard: true,
          },
        })
      : null;

    // 学習カード済みの投稿を優先取得（カード未生成の投稿も補完として含める）
    const postsWithCards = await prisma.post.findMany({
      where: {
        classification: { isNot: null },
        learningCard: { isNot: null },
        ...(postId ? { id: { not: postId } } : {}),
      },
      include: {
        classification: true,
        learningCard: true,
      },
      orderBy: { savedAt: "desc" },
      take: 25,
    });

    const postsWithoutCards = await prisma.post.findMany({
      where: {
        classification: { isNot: null },
        learningCard: null,
        ...(postId ? { id: { not: postId } } : {}),
      },
      include: {
        classification: true,
        learningCard: true,
      },
      orderBy: { savedAt: "desc" },
      take: Math.max(0, 30 - postsWithCards.length),
    });

    const allPosts = [...postsWithCards, ...postsWithoutCards];

    type PostWithCard = (typeof allPosts)[0];
    const toContext = (p: PostWithCard) => ({
      id: p.id,
      text: p.text,
      summary: p.classification?.summary,
      primaryCategory: p.classification?.primaryCategory,
      tags: p.classification ? (JSON.parse(p.classification.tagsJson || "[]") as string[]) : [],
      sourceUrl: p.sourceUrl,
      authorUsername: p.authorUsername,
      // 学習カード情報（生成済みの場合のみ）
      cardId: p.learningCard?.id ?? null,
      cardTitle: p.learningCard?.title ?? null,
      coreInsight: p.learningCard?.coreInsight ?? null,
    });

    const postContexts = [
      ...(focusPost ? [toContext(focusPost)] : []),
      ...allPosts.map(toContext),
    ];

    const reply = await getAiProvider().chat(message.trim(), history, postContexts);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat failed:", error);
    return NextResponse.json({ error: "チャットに失敗しました" }, { status: 500 });
  }
}
