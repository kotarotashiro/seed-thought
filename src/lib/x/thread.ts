import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "./tokenStore";
import { refreshAccessToken } from "./oauth";
import { fetchConversationTweets, fetchTweetById } from "./client";

interface ThreadFetchResult {
  fetchedCount: number;
  insertedCount: number;
  skippedCount: number;
}

export async function fetchAndSaveThread(postId: string): Promise<ThreadFetchResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { threadPosts: true },
  });

  if (!post) throw new Error("投稿が見つかりません");
  if (post.source !== "x" || !post.sourcePostId || !post.authorUsername) {
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
