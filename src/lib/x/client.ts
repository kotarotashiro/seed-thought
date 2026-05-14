// X API v2 Client

const BASE_URL = "https://api.twitter.com/2";

interface TweetData {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
}

interface UserData {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

interface XApiResponse {
  data?: TweetData[];
  includes?: {
    users?: UserData[];
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
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  sourceUrl: string;
}

const TWEET_FIELDS = "created_at,author_id,text";
const USER_FIELDS = "name,username,profile_image_url";
const EXPANSIONS = "author_id";

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
  response.includes?.users?.forEach((user) => {
    usersMap.set(user.id, user);
  });

  return response.data.map((tweet) => {
    const author = tweet.author_id ? usersMap.get(tweet.author_id) : undefined;
    return {
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at || null,
      authorName: author?.name || null,
      authorUsername: author?.username || null,
      authorAvatarUrl: author?.profile_image_url || null,
      sourceUrl: `https://x.com/${author?.username || "i"}/status/${tweet.id}`,
    };
  });
}

export async function fetchLikedTweets(
  userId: string,
  accessToken: string,
  maxResults: number = 10
): Promise<XTweetWithAuthor[]> {
  const response = await fetchFromX(`/users/${userId}/liked_tweets`, accessToken, {
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    expansions: EXPANSIONS,
  });

  return mapTweetsWithAuthors(response);
}

export async function fetchBookmarkedTweets(
  userId: string,
  accessToken: string,
  maxResults: number = 10
): Promise<XTweetWithAuthor[]> {
  const response = await fetchFromX(`/users/${userId}/bookmarks`, accessToken, {
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    expansions: EXPANSIONS,
  });

  return mapTweetsWithAuthors(response);
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
