// X posting helpers (Tweet write API).

const POST_TWEETS_URL = "https://api.twitter.com/2/tweets";
const MAX_TWEET_LENGTH = 280;

export interface PostedTweet {
  id: string;
  text: string;
}

interface PostBody {
  text: string;
  reply?: { in_reply_to_tweet_id: string };
}

async function postSingle(text: string, accessToken: string, replyTo?: string): Promise<PostedTweet> {
  const body: PostBody = { text };
  if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };

  const response = await fetch(POST_TWEETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`X post failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return {
    id: data.data?.id || "",
    text: data.data?.text || text,
  };
}

/**
 * Split content into thread-sized pieces. Tries paragraph breaks first,
 * then sentence breaks, then hard character wraps. Each piece is suffixed
 * with " (n/N)" so the user can read order at a glance, unless content
 * fits in a single tweet.
 */
export function splitIntoThread(raw: string, maxLength: number = MAX_TWEET_LENGTH): string[] {
  const text = raw.trim();
  if (text.length <= maxLength) return [text];

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = "";
    }
  };

  const addUnit = (unit: string) => {
    // Reserve space for thread suffix " (NN/NN)" — assume max 8 chars.
    const reserve = 8;
    const limit = maxLength - reserve;

    if (unit.length > limit) {
      // Sentence-level split
      const sentences = unit.split(/(?<=[。．.!?！？])\s*/);
      for (const sentence of sentences) {
        if (sentence.length > limit) {
          // Hard-wrap as last resort
          for (let i = 0; i < sentence.length; i += limit) {
            const piece = sentence.slice(i, i + limit);
            if ((buffer + (buffer ? "\n" : "") + piece).length > limit) flush();
            buffer = buffer ? `${buffer}\n${piece}` : piece;
            if (buffer.length >= limit) flush();
          }
        } else {
          if ((buffer + (buffer ? " " : "") + sentence).length > limit) flush();
          buffer = buffer ? `${buffer} ${sentence}` : sentence;
        }
      }
      flush();
      return;
    }

    if ((buffer + (buffer ? "\n\n" : "") + unit).length > limit) flush();
    buffer = buffer ? `${buffer}\n\n${unit}` : unit;
  };

  for (const para of paragraphs) {
    addUnit(para);
  }
  flush();

  const total = chunks.length;
  if (total === 1) return chunks;
  return chunks.map((c, i) => `${c} (${i + 1}/${total})`);
}

export async function postTweetOrThread(
  content: string,
  accessToken: string
): Promise<PostedTweet[]> {
  const pieces = splitIntoThread(content);
  const posted: PostedTweet[] = [];
  let replyTo: string | undefined;

  for (const piece of pieces) {
    const tweet = await postSingle(piece, accessToken, replyTo);
    posted.push(tweet);
    replyTo = tweet.id;
  }

  return posted;
}
