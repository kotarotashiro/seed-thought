import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  generateImage,
  ALL_IMAGE_MODELS,
  type ImageModel,
} from "@/lib/ai/imageProvider";

const VALID_KINDS = new Set(["explanation", "diagram", "custom"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  try {
    const images = await prisma.learningCardImage.findMany({
      where: { learningCardId: cardId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        prompt: true,
        mimeType: true,
        dataBase64: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ images });
  } catch (error) {
    console.error("Failed to list images:", error);
    return NextResponse.json(
      { error: "画像一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  try {
    const body = (await request.json()) as {
      kind?: string;
      prompt?: string;
      model?: string;
    };
    const kind = body.kind && VALID_KINDS.has(body.kind) ? body.kind : "explanation";

    const requestedModel = body.model ?? null;
    if (
      requestedModel !== null &&
      !(ALL_IMAGE_MODELS as readonly string[]).includes(requestedModel)
    ) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }
    const model = requestedModel as ImageModel | null;

    const card = await prisma.learningCard.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "学習カードが見つかりません" }, { status: 404 });
    }

    // Resolve prompt from kind, or use the explicit override.
    const prompt =
      body.prompt ??
      (kind === "diagram"
        ? card.diagramPrompt
        : kind === "explanation"
          ? card.imagePrompt
          : "");

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "プロンプトが空です" },
        { status: 400 }
      );
    }

    const generated = await generateImage(prompt, model);

    const saved = await prisma.learningCardImage.create({
      data: {
        learningCardId: cardId,
        kind,
        prompt,
        mimeType: generated.mimeType,
        dataBase64: generated.dataBase64,
      },
      select: {
        id: true,
        kind: true,
        prompt: true,
        mimeType: true,
        dataBase64: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ image: saved });
  } catch (error) {
    console.error("Failed to generate image:", error);
    const message = error instanceof Error ? error.message : "画像生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
