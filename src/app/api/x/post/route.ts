import { NextResponse } from "next/server";
import { postTweetOrThread, splitIntoThread } from "@/lib/x/post";
import { getConnectedXAccount, getFreshAccessToken } from "@/lib/x/tokens";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { content?: string };
    const content = (body.content || "").trim();
    if (!content) {
      return NextResponse.json(
        { error: "投稿する内容を指定してください" },
        { status: 400 }
      );
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
        {
          error:
            "tweet.write スコープが未付与です。/settings/x で一度切断し、再連携してください",
        },
        { status: 400 }
      );
    }

    const accessToken = await getFreshAccessToken(account);
    const tweets = await postTweetOrThread(content, accessToken);

    return NextResponse.json({
      tweets,
      firstUrl:
        tweets[0] && tweets[0].id
          ? `https://x.com/${account.username}/status/${tweets[0].id}`
          : null,
    });
  } catch (error) {
    console.error("Failed to post tweet:", error);
    const message = error instanceof Error ? error.message : "投稿に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Preview endpoint — returns how the content would be split into a thread.
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { content?: string };
    const content = (body.content || "").trim();
    if (!content) {
      return NextResponse.json({ pieces: [] });
    }
    return NextResponse.json({ pieces: splitIntoThread(content) });
  } catch (error) {
    console.error("Failed to preview thread:", error);
    return NextResponse.json({ error: "プレビューに失敗しました" }, { status: 500 });
  }
}
