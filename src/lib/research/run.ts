import { xaiChat } from "@/lib/xai/client";
import { prisma } from "@/lib/db/prisma";

export interface ResearchResult {
  id: string;
  query: string;
  answer: string;
  createdAt: Date;
}

export interface ResearchHistoryItem {
  id: string;
  query: string;
  createdAt: Date;
}

const SYSTEM_PROMPT =
  "日本語で回答してください。X（旧Twitter）とウェブの最新情報を検索し、テーマに関する重要な知見を出典付きでまとめてください。出典はURLや投稿者名を明記してください。";

export async function runResearch(query: string): Promise<ResearchResult> {
  const result = await xaiChat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: query },
    ],
    tools: [{ type: "x_search" }, { type: "web_search" }],
  });

  const session = await prisma.researchSession.create({
    data: { query, mode: "quick", source: "manual", answer: result.content },
  });

  return { id: session.id, query: session.query, answer: session.answer, createdAt: session.createdAt };
}

export async function getResearchById(id: string): Promise<ResearchResult | null> {
  const session = await prisma.researchSession.findUnique({ where: { id } });
  if (!session) return null;
  return { id: session.id, query: session.query, answer: session.answer, createdAt: session.createdAt };
}

export async function getResearchHistory(limit = 15): Promise<ResearchHistoryItem[]> {
  return prisma.researchSession.findMany({
    where: { source: "manual" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, query: true, createdAt: true },
  });
}
