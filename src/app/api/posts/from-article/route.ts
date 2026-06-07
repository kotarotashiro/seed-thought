import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import { createFallbackClassification } from "@/lib/ai/fallback";
import type { PostClassificationResult } from "@/lib/ai/types";

// LLM呼び出しあり（分類）。Vercel Hobby(Fluid Compute)上限の300秒まで引き上げ
export const maxDuration = 300;

interface ArticleApiResult {
  title?: string | null;
  description?: string | null;
  error?: string;
}

/**
 * 記事URLを自前フェッチして本文テキストを取得する。
 * og:description だけでは短すぎるため、本文 <article>/<main> を優先して抽出する。
 */
async function fetchArticleText(url: string): Promise<{ title: string | null; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { title: null, body: "" };
    }

    const html = (await res.text()).slice(0, 300_000);

    // タイトル
    const titleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : null;

    // 本文: <article> or <main> を優先、次いで <body>
    let bodyHtml =
      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
      html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
      html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
      html;

    // タグ・スクリプト・スタイルを除去してテキスト化
    const text = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 5000); // 学習カード生成の上限に合わせて5000字

    return { title, body: text };
  } catch {
    clearTimeout(timer);
    return { title: null, body: "" };
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, andLearn = false } = body as { url: string; andLearn?: boolean };

    if (!url || !/^https?:\/\/.+/.test(url)) {
      return NextResponse.json({ error: "有効なURLを入力してください" }, { status: 400 });
    }

    // 記事本文を取得
    const { title, body: articleBody } = await fetchArticleText(url);

    if (!articleBody || articleBody.length < 30) {
      // フォールバック: /api/fetch-article (Grok/og:description) を試みる
      const metaRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/fetch-article?url=${encodeURIComponent(url)}`).catch(() => null);
      const meta = metaRes?.ok ? (await metaRes.json() as ArticleApiResult) : null;
      if (!meta || (!meta.title && !meta.description)) {
        return NextResponse.json({ error: "記事の内容を取得できませんでした。URLが正しいか確認してください。" }, { status: 422 });
      }
      const fallbackText = [meta.title, meta.description].filter(Boolean).join("\n\n");
      const post = await createPostFromArticle(url, meta.title ?? null, fallbackText, andLearn);
      return NextResponse.json(post, { status: 201 });
    }

    const postText = title ? `${title}\n\n${articleBody}` : articleBody;
    const post = await createPostFromArticle(url, title, postText, andLearn);
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("from-article failed:", error);
    return NextResponse.json({ error: "記事の取り込みに失敗しました" }, { status: 500 });
  }
}

async function createPostFromArticle(
  url: string,
  title: string | null,
  text: string,
  andLearn: boolean
) {
  // 分類（LLM呼び出し）— 失敗時はフォールバック分類を使う
  const classification: PostClassificationResult = await getAiProvider()
    .classifyPost({ text, articleContent: text })
    .catch(() => createFallbackClassification({ text }));

  const post = await prisma.post.create({
    data: {
      source: "article_url",
      sourceUrl: url,
      savedType: "manual",
      text,
      authorName: title ?? null,
      enrichmentStatus: "done",
      classification: {
        create: {
          postType: classification.postType,
          primaryCategory: classification.primaryCategory,
          tagsJson: JSON.stringify(classification.tags),
          summary: classification.summary,
          recommendReason: classification.recommendReason ?? "",
          difficultyLevel: classification.difficultyLevel ?? "intermediate",
          outputPotentialScore: classification.outputPotentialScore ?? 0,
          learningPotentialScore: classification.learningPotentialScore ?? 0,
          thinkingPotentialScore: classification.thinkingPotentialScore ?? 0,
          recommendedMode: classification.recommendedMode ?? "learning_lesson",
        },
      },
    },
    include: { classification: true },
  });

  return { postId: post.id, andLearn };
}
