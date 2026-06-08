import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAiProvider } from "@/lib/ai/provider";
import { createFallbackClassification } from "@/lib/ai/fallback";
import type { PostClassificationResult } from "@/lib/ai/types";

export const maxDuration = 300;

/**
 * YouTubeのURLからvideo IDを抽出する。
 * 対応パターン:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/shorts/VIDEO_ID
 *   https://m.youtube.com/watch?v=VIDEO_ID
 */
function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^m\./, "");
    if (host === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    if (host === "www.youtube.com" || host === "youtube.com") {
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.replace("/shorts/", "").split("/")[0] || null;
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    // ignore
  }
  return null;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
}

/**
 * YouTube動画ページのHTMLから字幕トラック一覧を取得する。
 * ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks を参照。
 */
async function getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=ja`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const html = await res.text();

    // ytInitialPlayerResponse の JSON を抽出
    // YouTube は <script> タグ内に変数として埋め込んでいる
    const marker = "ytInitialPlayerResponse";
    const start = html.indexOf(`var ${marker} = `);
    if (start === -1) {
      // 別のパターンを試す
      const alt = html.indexOf(`${marker} = {`);
      if (alt === -1) return [];
      // ブラケット数を数えて対応するJSONを抽出
      return extractCaptionTracksFromJson(html, alt + `${marker} = `.length);
    }
    return extractCaptionTracksFromJson(html, start + `var ${marker} = `.length);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

function extractCaptionTracksFromJson(html: string, startIdx: number): CaptionTrack[] {
  // JSONの始まり "{" を見つける
  const jsonStart = html.indexOf("{", startIdx);
  if (jsonStart === -1) return [];

  // ブラケットカウンタでJSONの末尾を特定
  let depth = 0;
  let end = jsonStart;
  for (let i = jsonStart; i < Math.min(html.length, jsonStart + 2_000_000); i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  try {
    const playerData = JSON.parse(html.slice(jsonStart, end + 1)) as {
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: CaptionTrack[];
        };
      };
    };
    return playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  } catch {
    return [];
  }
}

/**
 * 字幕XMLを取得してプレーンテキストに変換する。
 * YouTube字幕のtimestampXML: <text start="..." dur="...">テキスト</text>
 */
async function fetchCaptionText(baseUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(baseUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SeedThought/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const xml = await res.text();
    // <text>タグの中身を抽出し、HTMLエンティティをデコード
    const matches = Array.from(xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g));
    const text = matches
      .map((m) => decodeHtmlEntities(m[1]))
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    return text;
  } catch {
    clearTimeout(timer);
    return "";
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * 動画タイトルをHTMLから取得する。
 */
function extractVideoTitle(html: string): string | null {
  const match =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].replace(/ - YouTube$/, "").trim()) : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, andLearn = false, transcriptText: manualTranscript } = body as {
      url: string;
      andLearn?: boolean;
      transcriptText?: string;
    };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URLを入力してください" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "YouTubeのURLを正しく入力してください（例: https://www.youtube.com/watch?v=...）" },
        { status: 400 }
      );
    }

    let transcriptText: string;

    if (manualTranscript && manualTranscript.trim().length >= 20) {
      // 手動貼り付けテキストを優先使用
      transcriptText = manualTranscript.trim();
    } else {
      // 自動取得を試みる
      const tracks = await getCaptionTracks(videoId);
      if (tracks.length === 0) {
        return NextResponse.json(
          {
            error:
              "字幕の自動取得に失敗しました。動画ページの「…」→「文字起こしを開く」でテキストをコピーして「字幕テキスト」欄に貼り付けてください。",
            canPasteManually: true,
          },
          { status: 422 }
        );
      }

      // 日本語 → 英語 → 手動字幕 → 自動字幕の優先順
      const preferred =
        tracks.find((t) => t.languageCode === "ja" && t.kind !== "asr") ??
        tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ??
        tracks.find((t) => t.languageCode === "ja") ??
        tracks.find((t) => t.languageCode === "en") ??
        tracks[0];

      const fetched = await fetchCaptionText(preferred.baseUrl);
      if (!fetched || fetched.length < 20) {
        return NextResponse.json(
          {
            error:
              "字幕の自動取得に失敗しました。動画ページの「…」→「文字起こしを開く」でテキストをコピーして「字幕テキスト」欄に貼り付けてください。",
            canPasteManually: true,
          },
          { status: 422 }
        );
      }
      transcriptText = fetched;
    }

    // 動画タイトルを取得
    let videoTitle: string | null = null;
    try {
      const titleRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ja" },
        signal: AbortSignal.timeout(8000),
      });
      videoTitle = extractVideoTitle(await titleRes.text());
    } catch {
      // タイトル取得失敗は無視
    }

    const postText = videoTitle
      ? `${videoTitle}\n\n【字幕テキスト】\n${transcriptText.slice(0, 4000)}`
      : `【YouTube字幕】\n${transcriptText.slice(0, 4000)}`;

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // 分類 — 失敗時はフォールバック分類を使う
    const classification: PostClassificationResult = await getAiProvider()
      .classifyPost({ text: postText })
      .catch(() => createFallbackClassification({ text: postText }));

    const post = await prisma.post.create({
      data: {
        source: "youtube_url",
        sourceUrl: videoUrl,
        savedType: "manual",
        text: postText,
        authorName: videoTitle ?? null,
        videoTranscriptText: transcriptText,
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

    return NextResponse.json({ postId: post.id, andLearn }, { status: 201 });
  } catch (error) {
    console.error("from-youtube failed:", error);
    return NextResponse.json({ error: "YouTube動画の取り込みに失敗しました" }, { status: 500 });
  }
}
