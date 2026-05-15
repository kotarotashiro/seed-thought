export interface ThreadTextPost {
  text: string;
  threadPosts?: { text: string; threadOrder: number }[];
}

export function buildPostTextWithThread(post: ThreadTextPost): string {
  const threadPosts = [...(post.threadPosts || [])].sort(
    (a, b) => a.threadOrder - b.threadOrder
  );

  if (threadPosts.length === 0) return post.text;

  return [
    `1. ${post.text}`,
    ...threadPosts.map((threadPost, index) => `${index + 2}. ${threadPost.text}`),
  ].join("\n\n");
}
