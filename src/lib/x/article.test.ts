import { describe, it, expect } from "vitest";
import { extractXArticleUrl, getXArticleId } from "./article";
import type { XTweetWithAuthor } from "./client";

function makeTweet(overrides: Partial<XTweetWithAuthor> = {}): XTweetWithAuthor {
  return {
    id: "1",
    text: "",
    createdAt: null,
    authorName: null,
    authorUsername: null,
    authorAvatarUrl: null,
    sourceUrl: "https://x.com/user/status/1",
    media: [],
    urlCard: null,
    ...overrides,
  };
}

describe("extractXArticleUrl", () => {
  it("returns expandedUrl when it is an X Article URL", () => {
    const tweet = makeTweet({
      urlCard: {
        expandedUrl: "https://x.com/i/article/1234567890",
        title: null,
        description: null,
        imageUrl: null,
      },
    });
    expect(extractXArticleUrl(tweet)).toBe("https://x.com/i/article/1234567890");
  });

  it("returns URL found in tweet text", () => {
    const tweet = makeTweet({
      text: "長文記事を書きました https://x.com/i/article/9876543210 ぜひ読んでね",
    });
    expect(extractXArticleUrl(tweet)).toBe("https://x.com/i/article/9876543210");
  });

  it("returns null for a normal post with no URL", () => {
    const tweet = makeTweet({ text: "今日はいい天気です" });
    expect(extractXArticleUrl(tweet)).toBeNull();
  });

  it("returns null for a long normal post without an X Article URL", () => {
    const tweet = makeTweet({
      text: "これは長文のポストですが X Article URL は含んでいません。URLはこちら https://note.com/user/n/n1234567890",
      urlCard: {
        expandedUrl: "https://note.com/user/n/n1234567890",
        title: "note記事",
        description: null,
        imageUrl: null,
      },
    });
    expect(extractXArticleUrl(tweet)).toBeNull();
  });

  it("returns X Article URL when tweet has normal text + X Article URL", () => {
    const tweet = makeTweet({
      text: "短めの本文 + https://x.com/i/article/111222333",
    });
    expect(extractXArticleUrl(tweet)).toBe("https://x.com/i/article/111222333");
  });

  it("accepts twitter.com/i/article/ domain", () => {
    const tweet = makeTweet({
      urlCard: {
        expandedUrl: "https://twitter.com/i/article/ABCDEF",
        title: null,
        description: null,
        imageUrl: null,
      },
    });
    expect(extractXArticleUrl(tweet)).toBe("https://twitter.com/i/article/ABCDEF");
  });
});

describe("getXArticleId", () => {
  it("extracts numeric article id", () => {
    expect(getXArticleId("https://x.com/i/article/1234567890")).toBe("1234567890");
  });

  it("extracts alphanumeric article id", () => {
    expect(getXArticleId("https://x.com/i/article/ABCDEF123")).toBe("ABCDEF123");
  });

  it("returns null for non-article URL", () => {
    expect(getXArticleId("https://x.com/user/status/999")).toBeNull();
  });
});
