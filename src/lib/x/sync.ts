import { prisma } from "@/lib/db/prisma";
import { fetchLikedTweets, fetchBookmarkedTweets, type XTweetWithAuthor } from "./client";
import { refreshAccessToken } from "./oauth";
import { decryptToken, encryptToken } from "./tokenStore";
import { getAiProvider } from "@/lib/ai/provider";
import { createFallbackClassification } from "@/lib/ai/fallback";
import { needsJapaneseTranslation } from "@/lib/text/language";

interface SyncResult {
  fetchedCount: number;
  matchedCount: number;
  insertedCount: number;
  skippedDuplicateCount: number;
  errorMessage?: string;
  partialErrors?: string[];
}

interface SyncDateRange {
  from?: Date | null;
  to?: Date | null;
}

function filterTweetsByPostedAt(
  tweets: XTweetWithAuthor[],
  dateRange?: SyncDateRange
): XTweetWithAuthor[] {
  if (!dateRange?.from && !dateRange?.to) return tweets;

  return tweets.filter((tweet) => {
    if (!tweet.createdAt) return false;
    const postedAt = new Date(tweet.createdAt).getTime();
    const from = dateRange.from?.getTime() ?? Number.NEGATIVE_INFINITY;
    const to = dateRange.to?.getTime() ?? Number.POSITIVE_INFINITY;
    return postedAt >= from && postedAt <= to;
  });
}

async function saveTweets(
  tweets: XTweetWithAuthor[],
  savedType: "like" | "bookmark",
  options: { enrichWithAi: boolean }
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

    let translatedText: string | null = null;
    if (options.enrichWithAi && needsJapaneseTranslation(tweet.text)) {
      try {
        translatedText = await getAiProvider().translateText({ text: tweet.text });
      } catch (error) {
        console.error("X post translation failed:", error);
      }
    }

    const post = await prisma.post.create({
      data: {
        source: savedType === "like" ? "user_like" : "user_bookmark",
        sourcePostId: tweet.id,
        sourceUrl: tweet.sourceUrl,
        savedType,
        authorName: tweet.authorName,
        authorUsername: tweet.authorUsername,
        authorAvatarUrl: tweet.authorAvatarUrl,
        text: tweet.text,
        translatedText,
        mediaJson: tweet.media.length > 0 ? JSON.stringify(tweet.media) : null,
        urlCardJson: tweet.urlCard ? JSON.stringify(tweet.urlCard) : null,
        postedAt: tweet.createdAt ? new Date(tweet.createdAt) : null,
        savedAt: new Date(),
        rawJson: JSON.stringify(tweet),
      },
    });

    const fallbackClassification = createFallbackClassification({ text: tweet.text });
    let classification = fallbackClassification;

    // Large X syncs must stay fast enough for serverless time limits.
    try {
      if (options.enrichWithAi) {
        const provider = getAiProvider();
        classification = await provider.classifyPost({
          text: tweet.text,
          authorName: tweet.authorName,
          authorUsername: tweet.authorUsername,
        });
      }
    } catch (error) {
      console.error("X post classification failed, using fallback:", error);
    }

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

    insertedCount++;
  }

  return { insertedCount, skippedDuplicateCount };
}

export async function syncXPosts(
  syncType: "likes" | "bookmarks" | "both",
  limit: number = 25,
  dateRange?: SyncDateRange
): Promise<{ syncRunId: string; results: SyncResult }> {
  // Get the connected X account
  const xAccount = await prisma.xAccount.findFirst();
  if (!xAccount) {
    throw new Error("Xアカウントが接続されていません。設定画面からXアカウントを接続してください。");
  }

  const accessToken = await getFreshAccessToken(xAccount);
  const enrichWithAi = limit <= 25;

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
    let totalMatched = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    const partialErrors: string[] = [];

    if (syncType === "likes" || syncType === "both") {
      try {
        const tweets = await fetchLikedTweets(xAccount.xUserId, accessToken, limit);
        const matchedTweets = filterTweetsByPostedAt(tweets, dateRange);
        totalFetched += tweets.length;
        totalMatched += matchedTweets.length;
        const result = await saveTweets(matchedTweets, "like", { enrichWithAi });
        totalInserted += result.insertedCount;
        totalSkipped += result.skippedDuplicateCount;
      } catch (error) {
        partialErrors.push(`いいね同期: ${getErrorMessage(error)}`);
      }
    }

    if (syncType === "bookmarks" || syncType === "both") {
      try {
        const tweets = await fetchBookmarkedTweets(xAccount.xUserId, accessToken, limit);
        const matchedTweets = filterTweetsByPostedAt(tweets, dateRange);
        totalFetched += tweets.length;
        totalMatched += matchedTweets.length;
        const result = await saveTweets(matchedTweets, "bookmark", { enrichWithAi });
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
        matchedCount: totalMatched,
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
        matchedCount: 0,
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
