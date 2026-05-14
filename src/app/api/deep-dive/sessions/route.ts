import { NextResponse } from "next/server";
import { createDeepDiveSession } from "@/lib/deep-dive/createSession";
import { getUserFacingError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

// POST /api/deep-dive/sessions - Create a new session
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postId, mode } = body;

    if (!postId || !mode) {
      return NextResponse.json(
        { error: "postId と mode が必要です" },
        { status: 400 }
      );
    }

    if (mode !== "thought_lens" && mode !== "learning_lesson") {
      return NextResponse.json(
        { error: "mode は thought_lens または learning_lesson を指定してください" },
        { status: 400 }
      );
    }

    const session = await createDeepDiveSession(postId, mode);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("Failed to create deep-dive session:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "深掘りセッションの作成に失敗しました") },
      { status: 500 }
    );
  }
}

// GET /api/deep-dive/sessions - List all sessions
export async function GET() {
  try {
    const sessions = await prisma.deepDiveSession.findMany({
      include: {
        post: { include: { classification: true } },
        steps: { orderBy: { stepIndex: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json(
      { error: "セッション一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
