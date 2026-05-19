import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import type { ChatMessage } from "@/lib/ai/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [] } = body as { message: string; history: ChatMessage[] };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
    }

    // Fetch recent posts with classification as context (latest 30)
    const posts = await prisma.post.findMany({
      where: { classification: { isNot: null } },
      include: { classification: true },
      orderBy: { savedAt: "desc" },
      take: 30,
    });

    const postContexts = posts.map((p) => ({
      id: p.id,
      text: p.text,
      summary: p.classification?.summary,
      primaryCategory: p.classification?.primaryCategory,
      tags: p.classification ? (JSON.parse(p.classification.tagsJson || "[]") as string[]) : [],
      sourceUrl: p.sourceUrl,
      authorUsername: p.authorUsername,
    }));

    const reply = await getAiProvider().chat(message.trim(), history, postContexts);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat failed:", error);
    return NextResponse.json({ error: "チャットに失敗しました" }, { status: 500 });
  }
}
