import { prisma } from "@/lib/db/prisma";
import { fetchLikedTweets, fetchBookmarkedTweets, type XTweetWithAuthor } from "./client";
import { refreshAccessToken } from "./oauth";
import { decryptToken, encryptToken } from "./tokenStore";
import { createFallbackClassification } from "@/lib/ai/fallback";
import { extractXArticleUrl } from "./article";

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

function parseScopes(scopesJson: string | null): string[] {
  if (!scopesJson) return [];
  try {
    const scopes = JSON.parse(scopesJson);
    return Array.isArray(scopes) ? scopes.map(String) : [];
  } catch {
    return [];
  }
}

function getMissingScopes(
  syncType: "likes" | "bookmarks" | "both",
  scopesJson: string | null
): string[] {
  const scopes = parseScopes(scopesJson);
  const required = new Set<string>();
  if (syncType === "likes" || syncType === "both") required.add("like.read");
  if (syncType === "bookmarks" || syncType === "both") required.add("bookmark.read");
  return [...required].filter((scope) => !scopes.includes(scope));
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
  savedType: "like" | "bookmark"
): Promise<{ insertedCount: number; skippedDuplicateCount: number; insertedPostIds: string[] }> {
  let insertedCount = 0;
  let skippedDuplicateCount = 0;
  const insertedPostIds: string[] = [];
  const sourcePostIds = tweets.map((tweet) => tweet.id).filter(Boolean);
  const existingRows = sourcePostIds.length > 0
    ? await prisma.post.findMany({
        where: {
          savedType,
          sourcePostId: { in: sourcePostIds },
        },
        select: { sourcePostId: true },
      })
    : [];
  const existingSourcePostIds = new Set(existingRows.map((row) => row.sourcePostId).filter(Boolean));

  for (const tweet of tweets) {
    if (existingSourcePostIds.has(tweet.id)) {
      skippedDuplicateCount++;
      continue;
    }

    const xArticleUrl = extractXArticleUrl(tweet);
    const hasUrl = Boolean(tweet.urlCard?.expandedUrl);
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
        translatedText: null,
        mediaJson: tweet.media.length > 0 ? JSON.stringify(tweet.media) : null,
        urlCardJson: tweet.urlCard ? JSON.stringify(tweet.urlCard) : null,
        postedAt: tweet.createdAt ? new Date(tweet.createdAt) : null,
        savedAt: new Date(),
        rawJson: JSON.stringify(tweet),
        enrichmentStatus: xArticleUrl ? "x_article_pending" : (hasUrl ? "pending" : "done"),
        autoLearnTask: {
          create: { status: "queued" },
        },
      },
    });

    const fallbackClassification = createFallbackClassification({ text: tweet.text });
    await prisma.postClassification.create({
      data: {
        postId: post.id,
        source: "fallback",
        postType: fallbackClassification.postType,
        primaryCategory: fallbackClassification.primaryCategory,
        tagsJson: JSON.stringify(fallbackClassification.tags),
        summary: fallbackClassification.summary,
        recommendReason: fallbackClassification.recommendReason,
        difficultyLevel: fallbackClassification.difficultyLevel,
        outputPotentialScore: fallbackClassification.outputPotentialScore,
        learningPotentialScore: fallbackClassification.learningPotentialScore,
        thinkingPotentialScore: fallbackClassification.thinkingPotentialScore,
        recommendedMode: fallbackClassification.recommendedMode,
      },
    });

    insertedCount++;
    insertedPostIds.push(post.id);
  }

  return { insertedCount, skippedDuplicateCount, insertedPostIds };
}

export async function syncXPosts(
  syncType: "likes" | "bookmarks" | "both",
  limit: number = 25,
  dateRange?: SyncDateRange
): Promise<{ syncRunId: string; results: SyncResult; insertedPostIds: string[] }> {
  // Get the connected X account
  const xAccount = await prisma.xAccount.findFirst();
  if (!xAccount) {
    throw new Error("Xアカウントが接続されていません。設定画面からXアカウントを接続してください。");
  }

  const missingScopes = getMissingScopes(syncType, xAccount.scopesJson);
  if (missingScopes.length > 0) {
    throw new Error(
      `X連携の読み取り権限が不足しています（不足: ${missingScopes.join(", ")}）。` +
      "一度Xアカウントの接続を解除し、再接続してから同期してください。"
    );
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
    let totalMatched = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    const insertedPostIds: string[] = [];
    const partialErrors: string[] = [];

    if (syncType === "likes" || syncType === "both") {
      try {
        const tweets = await fetchLikedTweets(xAccount.xUserId, accessToken, limit);
        const matchedTweets = filterTweetsByPostedAt(tweets, dateRange);
        totalFetched += tweets.length;
        totalMatched += matchedTweets.length;
        const result = await saveTweets(matchedTweets, "like");
        totalInserted += result.insertedCount;
        totalSkipped += result.skippedDuplicateCount;
        insertedPostIds.push(...result.insertedPostIds);
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
        const result = await saveTweets(matchedTweets, "bookmark");
        totalInserted += result.insertedCount;
        totalSkipped += result.skippedDuplicateCount;
        insertedPostIds.push(...result.insertedPostIds);
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
      insertedPostIds,
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
      insertedPostIds: [],
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
