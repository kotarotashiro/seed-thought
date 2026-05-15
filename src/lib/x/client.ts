// X API v2 Client

const BASE_URL = "https://api.twitter.com/2";

interface TweetData {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  conversation_id?: string;
  attachments?: {
    media_keys?: string[];
  };
}

interface UserData {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

interface MediaData {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
  alt_text?: string;
}

interface XApiResponse {
  data?: TweetData[];
  includes?: {
    users?: UserData[];
    media?: MediaData[];
  };
  meta?: {
    next_token?: string;
    result_count?: number;
  };
}

export interface XTweetWithAuthor {
  id: string;
  text: string;
  createdAt: string | null;
  conversationId?: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  sourceUrl: string;
  media: XTweetMedia[];
}

export interface XTweetMedia {
  type: "photo" | "video" | "animated_gif";
  url: string | null;
  previewUrl: string | null;
  altText: string | null;
}

const TWEET_FIELDS = "created_at,author_id,text,conversation_id,attachments";
const USER_FIELDS = "name,username,profile_image_url";
const MEDIA_FIELDS = "type,url,preview_image_url,alt_text";
const EXPANSIONS = "author_id,attachments.media_keys";

async function fetchFromX(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<XApiResponse> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function mapTweetsWithAuthors(response: XApiResponse): XTweetWithAuthor[] {
  if (!response.data) return [];

  const usersMap = new Map<string, UserData>();
  const mediaMap = new Map<string, MediaData>();
  response.includes?.users?.forEach((user) => {
    usersMap.set(user.id, user);
  });
  response.includes?.media?.forEach((media) => {
    mediaMap.set(media.media_key, media);
  });

  return response.data.map((tweet) => {
    const author = tweet.author_id ? usersMap.get(tweet.author_id) : undefined;
    const media = (tweet.attachments?.media_keys || [])
      .map((mediaKey) => mediaMap.get(mediaKey))
      .filter((item): item is MediaData => Boolean(item))
      .map((item) => ({
        type: item.type,
        url: item.url || item.preview_image_url || null,
        previewUrl: item.preview_image_url || item.url || null,
        altText: item.alt_text || null,
      }));
    return {
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at || null,
      conversationId: tweet.conversation_id || null,
      authorName: author?.name || null,
      authorUsername: author?.username || null,
      authorAvatarUrl: author?.profile_image_url || null,
      sourceUrl: `https://x.com/${author?.username || "i"}/status/${tweet.id}`,
      media,
    };
  });
}

export async function fetchTweetById(
  tweetId: string,
  accessToken: string
): Promise<XTweetWithAuthor | null> {
  const response = await fetchFromX(`/tweets/${tweetId}`, accessToken, {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: EXPANSIONS,
  });

  return mapTweetsWithAuthors({
    data: response.data ? [response.data as unknown as TweetData] : [],
    includes: response.includes,
    meta: response.meta,
  })[0] || null;
}

export async function fetchConversationTweets(
  conversationId: string,
  authorUsername: string,
  accessToken: string,
  maxResults: number = 50
): Promise<XTweetWithAuthor[]> {
  const response = await fetchFromX("/tweets/search/recent", accessToken, {
    query: `conversation_id:${conversationId} from:${authorUsername} -is:retweet`,
    max_results: String(Math.min(Math.max(maxResults, 10), 100)),
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: EXPANSIONS,
  });

  return mapTweetsWithAuthors(response).sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

export async function fetchLikedTweets(
  userId: string,
  accessToken: string,
  maxResults: number = 10
): Promise<XTweetWithAuthor[]> {
  return fetchTweetCollection(`/users/${userId}/liked_tweets`, accessToken, maxResults);
}

export async function fetchBookmarkedTweets(
  userId: string,
  accessToken: string,
  maxResults: number = 10
): Promise<XTweetWithAuthor[]> {
  return fetchTweetCollection(`/users/${userId}/bookmarks`, accessToken, maxResults);
}

async function fetchTweetCollection(
  endpoint: string,
  accessToken: string,
  maxResults: number
): Promise<XTweetWithAuthor[]> {
  const targetCount = Math.min(Math.max(maxResults, 10), 500);
  const tweets: XTweetWithAuthor[] = [];
  let nextToken: string | undefined;

  while (tweets.length < targetCount) {
    const pageSize = Math.min(100, Math.max(10, targetCount - tweets.length));
    const response = await fetchFromX(endpoint, accessToken, {
      max_results: String(pageSize),
      "tweet.fields": TWEET_FIELDS,
      "user.fields": USER_FIELDS,
      "media.fields": MEDIA_FIELDS,
      expansions: EXPANSIONS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });

    tweets.push(...mapTweetsWithAuthors(response));
    nextToken = response.meta?.next_token;
    if (!nextToken || !response.data?.length) break;
  }

  return tweets.slice(0, targetCount);
}

export async function fetchAuthenticatedUser(
  accessToken: string
): Promise<UserData> {
  const response = await fetch(`${BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data;
}
