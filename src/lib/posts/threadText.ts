export interface ThreadTextPost {
  text: string;
  translatedText?: string | null;
  threadPosts?: { text: string; translatedText?: string | null; threadOrder: number }[];
}

export function buildPostTextWithThread(post: ThreadTextPost): string {
  const threadPosts = [...(post.threadPosts || [])].sort(
    (a, b) => a.threadOrder - b.threadOrder
  );

  const formatText = (text: string, translatedText?: string | null) =>
    translatedText ? `${text}\n日本語訳: ${translatedText}` : text;

  if (threadPosts.length === 0) return formatText(post.text, post.translatedText);

  return [
    "以下はXのツリー投稿です。1つ目が最初に保存された投稿で、2つ目以降は後から取得した続きです。深掘りでは、必ずツリー全体の流れをひとまとまりの教材・思考対象として扱ってください。",
    "",
    `1. 元投稿\n${formatText(post.text, post.translatedText)}`,
    ...threadPosts.map(
      (threadPost, index) =>
        `${index + 2}. ツリー続き\n${formatText(threadPost.text, threadPost.translatedText)}`
    ),
  ].join("\n\n");
}
