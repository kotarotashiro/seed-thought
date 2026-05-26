import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthHeader } from "@/lib/xai/client";

const XAI_TTS_URL = "https://api.x.ai/v1/audio/speech";

export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const card = await prisma.learningCard.findUnique({
    where: { id: cardId },
    select: { title: true, summary: true, coreInsight: true },
  });

  if (!card) {
    return NextResponse.json({ error: "カードが見つかりません" }, { status: 404 });
  }

  const text = `${card.title}。${card.summary}。核心: ${card.coreInsight}`;

  try {
    const authHeader = await getAuthHeader();

    const res = await fetch(XAI_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model: "grok-tts",
        input: text,
        voice: "ja-JP-Wavenet-B",
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`xAI TTS ${res.status}: ${errText.slice(0, 200)}`);
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS failed";
    console.error("[audio]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
