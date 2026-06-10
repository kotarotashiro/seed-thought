import { describe, it, expect } from "vitest";
import {
  createFallbackClassification,
  isWeakClassification,
  mergeClassificationFallback,
} from "./fallback";
import type { PostClassificationResult } from "./types";

const strongClassification: PostClassificationResult = {
  postType: "learning",
  primaryCategory: "AI活用",
  tags: ["AI"],
  summary: "AIツールの実務応用について解説した投稿です。",
  recommendReason: "AI活用の具体的な手順やコツを自分の実務に置き換えて整理できます。",
  difficultyLevel: "intermediate",
  thinkingPotentialScore: 70,
  learningPotentialScore: 85,
  outputPotentialScore: 60,
  recommendedMode: "strict",
};

describe("createFallbackClassification", () => {
  it("produces all required fields", () => {
    const result = createFallbackClassification({ text: "テスト投稿" });
    expect(result).toHaveProperty("postType");
    expect(result).toHaveProperty("primaryCategory");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("recommendReason");
    expect(result).toHaveProperty("difficultyLevel");
    expect(Array.isArray(result.tags)).toBe(true);
    expect(typeof result.learningPotentialScore).toBe("number");
  });

  it("infers learning postType from 学習 keywords", () => {
    const result = createFallbackClassification({ text: "このAPIの使い方を解説します" });
    expect(result.postType).toBe("learning");
  });

  it("infers output_material postType from SNS keywords", () => {
    const result = createFallbackClassification({ text: "X(Twitter)での発信戦略について" });
    expect(result.postType).toBe("output_material");
  });

  it("infers AI活用 category for AI-related text", () => {
    const result = createFallbackClassification({ text: "Claude AIの最新機能が公開されました" });
    expect(result.primaryCategory).toBe("AI活用");
  });

  it("infers SNS運用 category for SNS text", () => {
    const result = createFallbackClassification({ text: "Instagram運用で大切なこと" });
    expect(result.primaryCategory).toBe("SNS運用");
  });

  it("infers マーケティング category for marketing text", () => {
    const result = createFallbackClassification({ text: "マーケ施策でLPの集客を改善した話" });
    expect(result.primaryCategory).toBe("マーケティング");
  });

  it("defaults to 思考整理 for generic text", () => {
    const result = createFallbackClassification({ text: "今日は考えたことをまとめました" });
    expect(result.primaryCategory).toBe("思考整理");
  });

  it("summary is non-empty", () => {
    const result = createFallbackClassification({ text: "短い" });
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

describe("isWeakClassification", () => {
  it("returns false for a strong classification", () => {
    expect(isWeakClassification(strongClassification)).toBe(false);
  });

  it("returns true when postType is unknown", () => {
    expect(isWeakClassification({ ...strongClassification, postType: "unknown" })).toBe(true);
  });

  it("returns true when primaryCategory is 未分類", () => {
    expect(isWeakClassification({ ...strongClassification, primaryCategory: "未分類" })).toBe(true);
  });

  it("returns true when summary is too short (< 18 chars)", () => {
    expect(isWeakClassification({ ...strongClassification, summary: "短すぎ" })).toBe(true);
  });

  it("returns true when summary contains 新しく保存された投稿", () => {
    expect(
      isWeakClassification({
        ...strongClassification,
        summary: "新しく保存された投稿です。",
      })
    ).toBe(true);
  });

  it("returns true when recommendReason contains 新しく保存された投稿", () => {
    expect(
      isWeakClassification({
        ...strongClassification,
        recommendReason: "新しく保存された投稿として分類されました。",
      })
    ).toBe(true);
  });
});

describe("mergeClassificationFallback", () => {
  it("returns the original unchanged when strong", () => {
    const result = mergeClassificationFallback("テキスト", strongClassification);
    expect(result).toBe(strongClassification);
  });

  it("replaces postType=unknown with fallback", () => {
    const weak = { ...strongClassification, postType: "unknown" as const };
    const result = mergeClassificationFallback("このAPIの使い方を解説します", weak);
    expect(result.postType).not.toBe("unknown");
  });

  it("replaces 未分類 primaryCategory with fallback", () => {
    const weak = { ...strongClassification, primaryCategory: "未分類" };
    const result = mergeClassificationFallback("Claude AIの活用について", weak);
    expect(result.primaryCategory).not.toBe("未分類");
  });

  it("replaces short summary with fallback", () => {
    const weak = { ...strongClassification, summary: "短い" };
    const result = mergeClassificationFallback("テスト投稿テキストです", weak);
    expect(result.summary.length).toBeGreaterThanOrEqual(18);
  });

  it("keeps strong fields from original even when other fields are weak", () => {
    const weak = { ...strongClassification, postType: "unknown" as const };
    const result = mergeClassificationFallback("テキスト", weak);
    // Strong fields like summary and recommendReason should be preserved
    expect(result.summary).toBe(strongClassification.summary);
    expect(result.recommendReason).toBe(strongClassification.recommendReason);
  });
});
