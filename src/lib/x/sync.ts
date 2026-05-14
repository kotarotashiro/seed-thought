import { prisma } from "@/lib/db/prisma";
import { fetchLikedTweets, fetchBookmarkedTweets, type XTweetWithAuthor } from "./client";
import { refreshAccessToken } from "./oauth";
import { decryptToken, encryptToken } from "./tokenStore";
import { getAiProvider } from "@/lib/ai/provider";

interface SyncResult {
  fetchedCount: number;
  insertedCount: number;
  skippedDuplicateCount: number;
  errorMessage?: string;
  partialErrors?: string[];
}

async function saveTweets(
  tweets: XTweetWithAuthor[],
  savedType: "like" | "bookmark"
): Promise<{ insertedCount: number; skippedDuplicateCount: number }> {
  let insertedCount = 0;
  let skippedDuplicateCount = 0;

  for (const tweet of tweets) {
    // Check for duplicates
    const existing = await prisma.post.findFirst({
      where: {
        sourcePostId: tweet.id,
        savedType,
      },
    });

    if (existing) {
      skippedDuplicateCount++;
      continue;
    }

    const post = await prisma.post.create({
      data: {
        source: "x",
        sourcePostId: tweet.id,
        sourceUrl: tweet.sourceUrl,
        savedType,
        authorName: tweet.authorName,
        authorUsername: tweet.authorUsername,
        authorAvatarUrl: tweet.authorAvatarUrl,
        text: tweet.text,
        postedAt: tweet.createdAt ? new Date(tweet.createdAt) : null,
        savedAt: new Date(),
        rawJson: JSON.stringify(tweet),
      },
    });

    // Attempt AI classification
    try {
      const provider = getAiProvider();
      const classification = await provider.classifyPost({
        text: tweet.text,
        authorName: tweet.authorName,
        authorUsername: tweet.authorUsername,
      });

      await prisma.postClassification.create({
        data: {
          postId: post.id,
          postType: classification.postType,
          primaryCategory: classification.primaryCategory,
          tagsJson: JSON.stringify(classification.tags),
          summary: classification.summary,
          recommendReason: classification.recommendReason,
          difficultyLevel: classification.difficultyLevel,
          outputPotentialScore: classification.outputPotentialScore,
          learningPotentialScore: classification.learningPotentialScore,
          thinkingPotentialScore: classification.thinkingPotentialScore,
          recommendedMode: classification.recommendedMode,
        },
      });
    } catch {
      // Create fallback classification
      await prisma.postClassification.create({
        data: {
          postId: post.id,
          postType: "unknown",
          primaryCategory: "未分類",
          tagsJson: "[]",
          summary: tweet.text.substring(0, 100),
          recommendReason: "新しく保存された投稿です。",
          difficultyLevel: "unknown",
          recommendedMode: "unknown",
        },
      });
    }

    insertedCount++;
  }

  return { insertedCount, skippedDuplicateCount };
}

export async function syncXPosts(
  syncType: "likes" | "bookmarks" | "both",
  limit: number = 25
): Promise<{ syncRunId: string; results: SyncResult }> {
  // Get the connected X account
  const xAccount = await prisma.xAccount.findFirst();
  if (!xAccount) {
    throw new Error("Xアカウントが接続されていません。設定画面からXアカウントを接続してください。");
  }

  const accessToken = await getFreshAccessToken(xAccount);

  // Create sync run record
  const syncRun = await prisma.xSyncRun.create({
    data: {
      xAccountId: xAccount.id,
      syncType,
      status: "running",
      requestedLimit: limit,
    },
  });

  try {
    let totalFetched = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    const partialErrors: string[] = [];

    if (syncType === "likes" || syncType === "both") {
      try {
        const tweets = await fetchLikedTweets(xAccount.xUserId, accessToken, limit);
        totalFetched += tweets.length;
        const result = await saveTweets(tweets, "like");
        totalInserted += result.insertedCount;
        totalSkipped += result.skippedDuplicateCount;
      } catch (error) {
        partialErrors.push(`いいね同期: ${getErrorMessage(error)}`);
      }
    }

    if (syncType === "bookmarks" || syncType === "both") {
      try {
        const tweets = await fetchBookmarkedTweets(xAccount.xUserId, accessToken, limit);
        totalFetched += tweets.length;
        const result = await saveTweets(tweets, "bookmark");
        totalInserted += result.insertedCount;
        totalSkipped += result.skippedDuplicateCount;
      } catch (error) {
        partialErrors.push(`ブックマーク同期: ${getErrorMessage(error)}`);
      }
    }

    if (partialErrors.length > 0 && totalFetched === 0) {
      throw new Error(partialErrors.join(" / "));
    }

    // Update sync run
    await prisma.xSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: partialErrors.length > 0 ? "partial" : "success",
        fetchedCount: totalFetched,
        insertedCount: totalInserted,
        skippedDuplicateCount: totalSkipped,
        errorMessage: partialErrors.length > 0 ? partialErrors.join(" / ") : null,
        finishedAt: new Date(),
      },
    });

    return {
      syncRunId: syncRun.id,
      results: {
        fetchedCount: totalFetched,
        insertedCount: totalInserted,
        skippedDuplicateCount: totalSkipped,
        partialErrors: partialErrors.length > 0 ? partialErrors : undefined,
      },
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    await prisma.xSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "failed",
        errorMessage,
        finishedAt: new Date(),
      },
    });

    return {
      syncRunId: syncRun.id,
      results: {
        fetchedCount: 0,
        insertedCount: 0,
        skippedDuplicateCount: 0,
        errorMessage,
      },
    };
  }
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "不明なエラーが発生しました";
}
