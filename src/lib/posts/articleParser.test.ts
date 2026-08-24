import { describe, expect, it } from "vitest";
import { mergeArticleCardJson } from "@/lib/posts/articleParser";

describe("mergeArticleCardJson", () => {
  it("記事URLの更新時も既存relatedLinksと貼り付け本文を保持する", () => {
    const merged = JSON.parse(
      mergeArticleCardJson(
        JSON.stringify({
          relatedLinks: [{ url: "https://related.example.com", title: "既存リンク" }],
          pastedContent: "既存の貼り付け本文",
          pastedByUser: true,
        }),
        JSON.stringify({ expandedUrl: "https://article.example.com", title: "新しい記事" }),
      ),
    ) as Record<string, unknown>;

    expect(merged.expandedUrl).toBe("https://article.example.com");
    expect(merged.pastedContent).toBe("既存の貼り付け本文");
    expect(merged.relatedLinks).toEqual([{ url: "https://related.example.com", title: "既存リンク" }]);
  });
});
