import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { submitVideoGeneration, pollVideoGeneration } from "@/lib/ai/grokVideoProvider";

export const maxDuration = 300;

// GET /api/learning-cards/[cardId]/videos — list videos for this card
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const videos = await prisma.learningCardVideo.findMany({
    where: { learningCardId: cardId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(videos);
}

// POST /api/learning-cards/[cardId]/videos — submit a new video generation job
export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const card = await prisma.learningCard.findUnique({
    where: { id: cardId },
    select: { title: true, coreInsight: true },
  });

  if (!card) {
    return NextResponse.json({ error: "カードが見つかりません" }, { status: 404 });
  }

  let prompt: string;
  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = body.prompt?.trim() || `${card.title}。${card.coreInsight}`;
  } catch {
    prompt = `${card.title}。${card.coreInsight}`;
  }

  try {
    const { jobId } = await submitVideoGeneration(prompt);

    const video = await prisma.learningCardVideo.create({
      data: {
        learningCardId: cardId,
        prompt,
        status: "processing",
        videoId: jobId,
      },
    });

    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "動画生成に失敗しました";
    console.error("[videos POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/learning-cards/[cardId]/videos?videoId=xxx — delete a video record
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const { searchParams } = new URL(request.url);
  const videoDbId = searchParams.get("videoId");

  if (!videoDbId) {
    return NextResponse.json({ error: "videoId が必要です" }, { status: 400 });
  }

  const record = await prisma.learningCardVideo.findFirst({
    where: { id: videoDbId, learningCardId: cardId },
  });

  if (!record) {
    return NextResponse.json({ error: "動画が見つかりません" }, { status: 404 });
  }

  await prisma.learningCardVideo.delete({ where: { id: videoDbId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/learning-cards/[cardId]/videos?videoId=xxx — poll job status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const { searchParams } = new URL(request.url);
  const videoDbId = searchParams.get("videoId");

  if (!videoDbId) {
    return NextResponse.json({ error: "videoId が必要です" }, { status: 400 });
  }

  const record = await prisma.learningCardVideo.findFirst({
    where: { id: videoDbId, learningCardId: cardId },
  });

  if (!record) {
    return NextResponse.json({ error: "動画が見つかりません" }, { status: 404 });
  }

  if (!record.videoId) {
    return NextResponse.json(record);
  }

  try {
    const job = await pollVideoGeneration(record.videoId);

    const updated = await prisma.learningCardVideo.update({
      where: { id: videoDbId },
      data: {
        status: job.status,
        videoUrl: job.videoUrl ?? record.videoUrl,
        thumbnailUrl: job.thumbnailUrl ?? record.thumbnailUrl,
        errorMessage: job.errorMessage ?? record.errorMessage,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "polling failed";
    console.error("[videos PATCH]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
