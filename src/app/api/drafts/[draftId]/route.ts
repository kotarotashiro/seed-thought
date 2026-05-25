import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { postTweetOrThread } from "@/lib/x/post";
import { getConnectedXAccount, getFreshAccessToken } from "@/lib/x/tokens";

// PATCH: update status or content
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const { draftId } = await params;
  try {
    const body = (await request.json()) as {
      status?: "pending" | "approved" | "rejected";
      content?: string;
    };

    const allowedStatuses = ["pending", "approved", "rejected"] as const;
    if (body.status !== undefined && !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
    }

    const draft = await prisma.xDraft.update({
      where: { id: draftId },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
      },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Failed to update draft:", error);
    return NextResponse.json({ error: "下書きの更新に失敗しました" }, { status: 500 });
  }
}

// DELETE: remove a draft
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const { draftId } = await params;
  try {
    await prisma.xDraft.delete({ where: { id: draftId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete draft:", error);
    return NextResponse.json({ error: "下書きの削除に失敗しました" }, { status: 500 });
  }
}

// POST: post to X immediately
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const { draftId } = await params;
  try {
    const draft = await prisma.xDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      return NextResponse.json({ error: "下書きが見つかりません" }, { status: 404 });
    }
    if (draft.status === "posted") {
      return NextResponse.json({ error: "すでに投稿済みです" }, { status: 400 });
    }

    const account = await getConnectedXAccount();
    if (!account) {
      return NextResponse.json(
        { error: "X連携が未設定です。/settings/x から連携してください" },
        { status: 400 }
      );
    }

    const scopes = (JSON.parse(account.scopesJson || "[]") as string[]) || [];
    if (!scopes.includes("tweet.write")) {
      return NextResponse.json(
        { error: "tweet.write スコープが未付与です。X設定で再連携してください" },
        { status: 400 }
      );
    }

    const accessToken = await getFreshAccessToken(account);
    const tweets = await postTweetOrThread(draft.content, accessToken);
    const firstUrl =
      tweets[0]?.id ? `https://x.com/${account.username}/status/${tweets[0].id}` : null;

    await prisma.xDraft.update({
      where: { id: draftId },
      data: { status: "posted", postedUrl: firstUrl ?? undefined, postedAt: new Date() },
    });

    return NextResponse.json({ ok: true, url: firstUrl });
  } catch (error) {
    console.error("Failed to post draft to X:", error);
    const message = error instanceof Error ? error.message : "投稿に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
