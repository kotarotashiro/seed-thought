import { describe, it, expect } from "vitest";
import { stripMarkdownForX } from "./markdown";

describe("stripMarkdownForX", () => {
  it("行頭の半角見出し記号を除去し、テキストは残す", () => {
    expect(stripMarkdownForX("## タイトル")).toBe("タイトル");
    expect(stripMarkdownForX("# 見出し1\n## 見出し2")).toBe("見出し1\n見出し2");
    expect(stripMarkdownForX("### サブセクション")).toBe("サブセクション");
  });

  it("行頭の全角見出し記号を除去する", () => {
    expect(stripMarkdownForX("＃ 全角見出し")).toBe("全角見出し");
    expect(stripMarkdownForX("＃＃ 全角2")).toBe("全角2");
  });

  it("ハッシュタグ（# + 空白なし）は保持する", () => {
    expect(stripMarkdownForX("#AI活用")).toBe("#AI活用");
    expect(stripMarkdownForX("本文 #AI #生産性")).toBe("本文 #AI #生産性");
    expect(stripMarkdownForX("## 見出し\n#AI活用の話")).toBe("見出し\n#AI活用の話");
  });

  it("太字記号 **text** / __text__ を除去する", () => {
    expect(stripMarkdownForX("**重要なポイント**")).toBe("重要なポイント");
    expect(stripMarkdownForX("__これも太字__")).toBe("これも太字");
    expect(stripMarkdownForX("前の**ポイント**後ろ")).toBe("前のポイント後ろ");
  });

  it("コードスパン `code` を除去する", () => {
    expect(stripMarkdownForX("`syncXPosts`")).toBe("syncXPosts");
    expect(stripMarkdownForX("関数 `foo()` を呼ぶ")).toBe("関数 foo() を呼ぶ");
  });

  it("note / 他媒体の出力を変えない（= X以外には適用しない前提）", () => {
    // この関数自体は常に加工するが、OutputPreview側でX以外には呼ばない設計
    // 見出しなしのテキストがそのまま返ることを確認
    const plain = "普通のテキストです。改行\nもあります。";
    expect(stripMarkdownForX(plain)).toBe(plain);
  });
});
