import { xaiChat } from "@/lib/xai/client";
import { prisma } from "@/lib/db/prisma";
import { parseAiJson } from "@/lib/ai/json";

export type ResearchMode = "quick" | "deep";

export interface ResearchResult {
  id: string;
  query: string;
  // "quick" | "deep" | "account"
  mode: string;
  answer: string;
  createdAt: Date;
}

export interface ResearchHistoryItem {
  id: string;
  query: string;
  mode: string;
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

  return toResult(session);
}

// ── Deep research ───────────────────────────────────────────────────────────────
// テーマを小問に分解 → 各小問を並列でライブ検索 → 統合レポート化、の3段。
// 並列化することで Vercel Hobby の300秒上限に余裕を持たせる。

const MAX_SUB_QUERIES = 3;

interface SubQueryPlan {
  subQueries: string[];
}

function isSubQueryPlan(v: unknown): v is SubQueryPlan {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as SubQueryPlan).subQueries) &&
    (v as SubQueryPlan).subQueries.every((q) => typeof q === "string")
  );
}

async function planSubQueries(query: string): Promise<string[]> {
  const result = await xaiChat({
    jsonMode: true,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "あなたはリサーチ設計者です。与えられたテーマを、最新情報を集めるための独立した調査観点に分解してください。" +
          `観点は最大${MAX_SUB_QUERIES}個まで。それぞれ検索クエリとして成立する具体的な日本語の問いにすること。` +
          'JSONのみで返答: {"subQueries": ["問い1", "問い2", "問い3"]}',
      },
      { role: "user", content: query },
    ],
  });

  try {
    const plan = parseAiJson(result.content, isSubQueryPlan, "リサーチ計画");
    const cleaned = plan.subQueries.map((q) => q.trim()).filter(Boolean).slice(0, MAX_SUB_QUERIES);
    return cleaned.length > 0 ? cleaned : [query];
  } catch {
    // 計画に失敗したらテーマそのものを単一クエリとして調べる（深掘り版の劣化フォールバック）。
    return [query];
  }
}

async function searchSubQuery(subQuery: string): Promise<string> {
  const result = await xaiChat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: subQuery },
    ],
    tools: [{ type: "x_search" }, { type: "web_search" }],
  });
  return result.content;
}

async function synthesize(query: string, findings: { subQuery: string; content: string }[]): Promise<string> {
  const body = findings
    .map((f, i) => `## 観点${i + 1}: ${f.subQuery}\n${f.content}`)
    .join("\n\n");

  const result = await xaiChat({
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "日本語で回答してください。複数の調査観点の結果を統合し、構造化されたリサーチレポートをMarkdownで作成してください。" +
          "構成: 「## 概要」（3〜4行の要約）→「## 観点ごとの知見」（観点別に整理）→「## 統合した示唆」（横断的な洞察）→「## 出典」（URL・投稿者をまとめる）。" +
          "重複は統合し、矛盾があれば明示してください。",
      },
      { role: "user", content: `テーマ: ${query}\n\n以下は各観点の調査結果です。\n\n${body}` },
    ],
  });
  return result.content;
}

export async function runDeepResearch(query: string): Promise<ResearchResult> {
  const subQueries = await planSubQueries(query);

  const settled = await Promise.allSettled(subQueries.map((sq) => searchSubQuery(sq)));
  const findings = subQueries
    .map((subQuery, i) => {
      const r = settled[i];
      return r.status === "fulfilled" ? { subQuery, content: r.value } : null;
    })
    .filter((f): f is { subQuery: string; content: string } => f !== null);

  if (findings.length === 0) {
    throw new Error("深掘りリサーチの検索がすべて失敗しました");
  }

  const answer = await synthesize(query, findings);

  const session = await prisma.researchSession.create({
    data: {
      query,
      mode: "deep",
      source: "manual",
      answer,
      sourcesJson: JSON.stringify(findings.map((f) => f.subQuery)),
    },
  });

  return toResult(session);
}

function toResult(session: {
  id: string;
  query: string;
  mode: string;
  answer: string;
  createdAt: Date;
}): ResearchResult {
  return {
    id: session.id,
    query: session.query,
    mode: session.mode,
    answer: session.answer,
    createdAt: session.createdAt,
  };
}

// ── Account analysis（競合分析）─────────────────────────────────────────────────
// 指定したXアカウントの投稿だけを x_search の allowed_x_handles で絞り込み、
// 発信傾向・型・強みを競合分析レポートにまとめる。既存の quick/deep と同じく
// xaiChat（サブスクOAuth優先・APIキーfallback）に乗るため追加課金は基本なし。

/** "@name" / URL / 余分な記号 を取り除き、X handle 本体（英数字と _）を取り出す */
export function normalizeHandle(input: string): string {
  let h = input.trim();
  const urlMatch = h.match(/(?:x|twitter)\.com\/(?:#!\/)?@?([A-Za-z0-9_]{1,15})/i);
  if (urlMatch) h = urlMatch[1];
  h = h.replace(/^@+/, "");
  return h.replace(/[^A-Za-z0-9_]/g, "");
}

const ACCOUNT_SYSTEM_PROMPT =
  "あなたはSNS発信の競合分析が得意なアナリストです。日本語で回答してください。" +
  "指定されたXアカウントの投稿を調べ、その発信を競合分析レポートとしてMarkdownでまとめてください。" +
  "分析は直近1〜2日の投稿だけに偏らせず、できるだけ多くの投稿と幅広い話題を確認したうえで一般化してください。" +
  "構成: 「## アカウント概要」（何者か・主な発信領域に加え、観測できた範囲で投稿の頻度や量にも触れる。2〜4行）→" +
  "「## 主要テーマ」（繰り返し扱う話題を箇条書き）→" +
  "「## 投稿の型・スタイル」（フック・構成・長さ・語り口の特徴）→" +
  "「## 強み・差別化点」→" +
  "「## 反応が良い投稿の傾向」（いいね・リポスト等の反応数が取得できた場合のみ具体的に挙げ、取得できない場合は推測である旨を明示して断定しない）→" +
  "「## 自分の発信に活かすヒント」（取り入れられる点を3つ）→" +
  "「## 出典」（参照した投稿のURLや日付。確認できた投稿が少ない場合はサンプルが限定的である旨も明記）。" +
  "全体として、推測は断定せず『〜の傾向』と表現してください。";

export async function runAccountAnalysis(handleInput: string): Promise<ResearchResult> {
  const handle = normalizeHandle(handleInput);
  if (!handle) {
    throw new Error("Xアカウント名（@ハンドル）を入力してください");
  }

  const result = await xaiChat({
    messages: [
      { role: "system", content: ACCOUNT_SYSTEM_PROMPT },
      { role: "user", content: `@${handle} というXアカウントを競合分析してください。` },
    ],
    tools: [
      {
        type: "x_search",
        allowed_x_handles: [handle],
        enable_image_understanding: true,
      },
    ],
  });

  const session = await prisma.researchSession.create({
    data: { query: `@${handle}`, mode: "account", source: "manual", answer: result.content },
  });

  return toResult(session);
}

export async function getResearchById(id: string): Promise<ResearchResult | null> {
  const session = await prisma.researchSession.findUnique({ where: { id } });
  if (!session) return null;
  return toResult(session);
}

export async function getResearchHistory(limit = 15): Promise<ResearchHistoryItem[]> {
  return prisma.researchSession.findMany({
    where: { source: "manual" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, query: true, mode: true, createdAt: true },
  });
}
