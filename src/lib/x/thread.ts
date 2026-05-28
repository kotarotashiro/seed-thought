import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "./tokenStore";
import { refreshAccessToken } from "./oauth";
import { fetchConversationTweets, fetchTweetById } from "./client";
import { getAiProvider } from "@/lib/ai/provider";
import { needsJapaneseTranslation } from "@/lib/text/language";

interface ThreadFetchResult {
  fetchedCount: number;
  insertedCount: number;
  skippedCount: number;
}

interface ManualThreadInput {
  url: string;
  text: string;
  translatedText: string | null;
}

// X URL から tweet ID を抽出（https://x.com/user/status/1234567 形式）
function extractTweetIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  // tweet ID 単体（数字のみ）もそのまま受け付ける
  if (/^\d{5,}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:^|\/)(?:status(?:es)?|i\/web\/status)\/(\d+)(?:[/?#]|$)/i);
  return m ? m[1] : null;
}

async function nextThreadOrder(postId: string): Promise<number> {
  const last = await prisma.threadPost.findFirst({
    where: { postId },
    orderBy: { threadOrder: "desc" },
    select: { threadOrder: true },
  });
  return (last?.threadOrder ?? 0) + 1;
}

/**
 * ツリーを手動で追記する。X API が "続きの投稿は見つかりませんでした" 等で失敗したときの逃げ道。
 * - input.url が指定されていれば X API でその tweet を取得して追記
 * - 取得できない / text のみのときは手動入力としてそのまま保存
 */
export async function addManualThreadPost(
  postId: string,
  input: ManualThreadInput
): Promise<{ insertedCount: number; source: "x_api" | "manual_text" }> {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error("投稿が見つかりません");

  // 1) URL/ID指定 → X API で取得を試みる
  if (input.url) {
    const tweetId = extractTweetIdFromUrl(input.url);
    if (!tweetId) {
      // URLパースできない → text として扱う
      if (!input.text) {
        throw new Error("有効な X 投稿のURLまたは tweet ID を指定してください");
      }
    } else {
      const xAccount = await prisma.xAccount.findFirst();
      if (xAccount) {
        try {
          const accessToken = await getFreshAccessToken(xAccount);
          const tweet = await fetchTweetById(tweetId, accessToken);
          if (tweet) {
            const order = await nextThreadOrder(postId);
            let translatedText: string | null = input.translatedText;
            if (!translatedText && needsJapaneseTranslation(tweet.text)) {
              try {
                translatedText = await getAiProvider().translateText({ text: tweet.text });
              } catch (error) {
                console.error("Manual thread translation failed:", error);
              }
            }
            await prisma.threadPost.upsert({
              where: {
                postId_sourcePostId: {
                  postId,
                  sourcePostId: tweet.id,
                },
              },
              create: {
                postId,
                sourcePostId: tweet.id,
                sourceUrl: tweet.sourceUrl,
                authorName: tweet.authorName,
                authorUsername: tweet.authorUsername,
                authorAvatarUrl: tweet.authorAvatarUrl,
                text: tweet.text,
                translatedText,
                mediaJson: tweet.media.length > 0 ? JSON.stringify(tweet.media) : null,
                postedAt: tweet.createdAt ? new Date(tweet.createdAt) : null,
                threadOrder: order,
                rawJson: JSON.stringify(tweet),
              },
              update: {
                sourceUrl: tweet.sourceUrl,
                authorName: tweet.authorName,
                authorUsername: tweet.authorUsername,
                authorAvatarUrl: tweet.authorAvatarUrl,
                text: tweet.text,
                translatedText,
                mediaJson: tweet.media.length > 0 ? JSON.stringify(tweet.media) : null,
                postedAt: tweet.createdAt ? new Date(tweet.createdAt) : null,
                rawJson: JSON.stringify(tweet),
              },
            });
            return { insertedCount: 1, source: "x_api" };
          }
        } catch (error) {
          console.warn("[thread] X API fetch failed, falling back to manual text:", error);
          // X API失敗 → text fallback
        }
      }
      // X API も使えず、textも無い → エラー
      if (!input.text) {
        throw new Error(
          "X APIで該当投稿を取得できませんでした。Xアカウントを再接続するか、本文を直接入力してください。"
        );
      }
    }
  }

  // 2) 本文の手動入力で追記（URL未指定 or URLで失敗したとき）
  const text = input.text.trim();
  if (!text) {
    throw new Error("追記する本文を入力してください");
  }
  const order = await nextThreadOrder(postId);
  let translatedText: string | null = input.translatedText;
  if (!translatedText && needsJapaneseTranslation(text)) {
    try {
      translatedText = await getAiProvider().translateText({ text });
    } catch (error) {
      console.error("Manual thread translation failed:", error);
    }
  }

  // sourcePostId に手動エントリを示すユニーク値を入れる（@@unique(postId, sourcePostId) 対応）
  const manualSourceId = `manual:${Date.now()}:${order}`;

  await prisma.threadPost.create({
    data: {
      postId,
      sourcePostId: manualSourceId,
      sourceUrl: input.url || null,
      authorName: post.authorName,
      authorUsername: post.authorUsername,
      authorAvatarUrl: post.authorAvatarUrl,
      text,
      translatedText,
      mediaJson: null,
      postedAt: null,
      threadOrder: order,
      rawJson: JSON.stringify({ manual: true, addedAt: new Date().toISOString() }),
    },
  });
  return { insertedCount: 1, source: "manual_text" };
}

export async function fetchAndSaveThread(postId: string): Promise<ThreadFetchResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { threadPosts: true },
  });

  if (!post) throw new Error("投稿が見つかりません");
  const isFromX = post.source === "user_like" || post.source === "user_bookmark";
  if (!isFromX || !post.sourcePostId || !post.authorUsername) {
    throw new Error("X由来の投稿だけツリーを取得できます");
  }

  const xAccount = await prisma.xAccount.findFirst();
  if (!xAccount) {
    throw new Error("Xアカウントが接続されていません。設定画面からXアカウントを接続してください。");
  }

  const accessToken = await getFreshAccessToken(xAccount);
  const rootTweet = await fetchTweetById(post.sourcePostId, accessToken);
  const conversationId = rootTweet?.conversationId || post.sourcePostId;

  const tweets = await fetchConversationTweets(
    conversationId,
    post.authorUsername,
    accessToken,
    50
  );

  const childTweets = tweets
    .filter((tweet) => tweet.id !== post.sourcePostId)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

  let insertedCount = 0;
  let skippedCount = 0;

  for (const [index, tweet] of childTweets.entries()) {
    let translatedText: string | null = null;
    if (needsJapaneseTranslation(tweet.text)) {
      try {
        translatedText = await getAiProvider().translateText({ text: tweet.text });
      } catch (error) {
        console.error("Thread post translation failed:", error);
      }
    }

    const result = await prisma.threadPost.upsert({
      where: {
        postId_sourcePostId: {
          postId,
          sourcePostId: tweet.id,
        },
      },
      create: {
        postId,
        sourcePostId: tweet.id,
        sourceUrl: tweet.sourceUrl,
        authorName: tweet.authorName,
        authorUsername: tweet.authorUsername,
        authorAvatarUrl: tweet.authorAvatarUrl,
        text: tweet.text,
        translatedText,
        mediaJson: tweet.media.length > 0 ? JSON.stringify(tweet.media) : null,
        postedAt: tweet.createdAt ? new Date(tweet.createdAt) : null,
        threadOrder: index + 1,
        rawJson: JSON.stringify(tweet),
      },
      update: {
        sourceUrl: tweet.sourceUrl,
        authorName: tweet.authorName,
        authorUsername: tweet.authorUsername,
        authorAvatarUrl: tweet.authorAvatarUrl,
        text: tweet.text,
        translatedText,
        mediaJson: tweet.media.length > 0 ? JSON.stringify(tweet.media) : null,
        postedAt: tweet.createdAt ? new Date(tweet.createdAt) : null,
        threadOrder: index + 1,
        rawJson: JSON.stringify(tweet),
      },
    });

    if (post.threadPosts.some((threadPost) => threadPost.sourcePostId === result.sourcePostId)) {
      skippedCount++;
    } else {
      insertedCount++;
    }
  }

  return {
    fetchedCount: childTweets.length,
    insertedCount,
    skippedCount,
  };
}

async function getFreshAccessToken(account: {
  id: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
  const shouldRefresh = Boolean(
    account.refreshTokenEncrypted && expiresAt && expiresAt - Date.now() < 60_000
  );

  if (!shouldRefresh) {
    return decryptToken(account.accessTokenEncrypted);
  }

  const refreshToken = decryptToken(account.refreshTokenEncrypted as string);
  const refreshed = await refreshAccessToken(refreshToken);

  await prisma.xAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEncrypted: encryptToken(refreshed.accessToken),
      refreshTokenEncrypted: refreshed.refreshToken
        ? encryptToken(refreshed.refreshToken)
        : account.refreshTokenEncrypted,
      tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
    },
  });

  return refreshed.accessToken;
}
