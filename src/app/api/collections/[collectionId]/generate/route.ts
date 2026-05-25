import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import {
  buildCollectionPrompt,
  type CollectionOutputKind,
} from "@/lib/ai/collectionPrompt";
import { getAiRuntimeSettings } from "@/lib/ai/settings";

const VALID_KINDS = new Set<CollectionOutputKind>([
  "seminar",
  "mini_course",
  "note",
  "newsletter",
]);

function getOpenAiBaseUrl(provider: string): string | undefined {
  if (provider === "grok") return "https://api.x.ai/v1";
  if (provider === "kimi") return "https://api.moonshot.ai/v1";
  return undefined;
}

async function callProvider(prompt: string): Promise<string> {
  const settings = await getAiRuntimeSettings();
  if (!settings.apiKey) throw new Error("AI APIキーが設定されていません");

  if (settings.provider === "gemini") {
    const client = new GoogleGenAI({ apiKey: settings.apiKey });
    const response = await client.models.generateContent({
      model: settings.model,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    return response.text || "{}";
  }

  if (settings.provider === "claude") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 8192,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
    const data = await response.json();
    const blocks = Array.isArray(data.content)
      ? data.content
          .filter((b: { type?: string }) => b.type === "text")
          .map((b: { text?: string }) => b.text || "")
      : [];
    return blocks.join("\n").trim() || "{}";
  }

  if (settings.provider === "openai" || settings.provider === "grok" || settings.provider === "kimi") {
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: getOpenAiBaseUrl(settings.provider),
    });
    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });
    return response.choices[0]?.message?.content || "{}";
  }

  throw new Error("対応していないAIプロバイダーです");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  try {
    const body = (await request.json()) as { outputKind?: CollectionOutputKind };
    const outputKind =
      body.outputKind && VALID_KINDS.has(body.outputKind) ? body.outputKind : "seminar";

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            learningCard: {
              include: {
                sourcePost: { include: { classification: true } },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      return NextResponse.json({ error: "コレクションが見つかりません" }, { status: 404 });
    }
    if (collection.items.length === 0) {
      return NextResponse.json(
        { error: "コレクションに学習カードがありません" },
        { status: 400 }
      );
    }

    const prompt = await buildCollectionPrompt({
      collectionTitle: collection.title,
      collectionDescription: collection.description,
      collectionIdea: collection.idea,
      outputKind,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cards: collection.items.map((item: any) => ({
        title: item.learningCard.title,
        summary: item.learningCard.summary,
        coreInsight: item.learningCard.coreInsight,
        manual: item.learningCard.manual,
        userMemo: item.learningCard.userMemo,
        category:
          item.learningCard.sourcePost.classification?.primaryCategory ?? null,
      })),
    });

    const raw = await callProvider(prompt);

    // Strip code fences if any
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // fallback: store raw as content
      parsed = { title: collection.title, body: cleaned };
    }

    const outputJson = JSON.stringify({
      kind: outputKind,
      generatedAt: new Date().toISOString(),
      content: parsed,
    });

    await prisma.collection.update({
      where: { id: collectionId },
      data: { outputJson },
    });

    return NextResponse.json({ outputKind, content: parsed });
  } catch (error) {
    console.error("Failed to generate collection output:", error);
    const message = error instanceof Error ? error.message : "コンテンツ生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
