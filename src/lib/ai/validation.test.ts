import { describe, it, expect } from "vitest";
import {
  isDecodeOutput,
  isPostClassificationResult,
  isGeneratedOutputResult,
  isSemanticSearchResult,
  isTrendInsight,
  isLearningCoreOutput,
  isLearningSupplementOutput,
  isStrictLearningOutput,
} from "./validation";

const validClassification = {
  postType: "learning",
  primaryCategory: "AI活用",
  tags: ["AI", "活用"],
  summary: "AIツールの使い方を解説している投稿です。",
  recommendReason: "実務での応用が期待できる内容です。",
  difficultyLevel: "intermediate",
  thinkingPotentialScore: 70,
  learningPotentialScore: 85,
  outputPotentialScore: 60,
  recommendedMode: "strict",
};

describe("isPostClassificationResult", () => {
  it("accepts a valid classification", () => {
    expect(isPostClassificationResult(validClassification)).toBe(true);
  });

  it("rejects when postType is not in allowed list", () => {
    expect(isPostClassificationResult({ ...validClassification, postType: "random" })).toBe(false);
  });

  it("rejects when difficultyLevel is invalid", () => {
    expect(isPostClassificationResult({ ...validClassification, difficultyLevel: "hard" })).toBe(false);
  });

  it("rejects when a score is out of range (> 100)", () => {
    expect(isPostClassificationResult({ ...validClassification, learningPotentialScore: 101 })).toBe(false);
  });

  it("rejects when a score is negative", () => {
    expect(isPostClassificationResult({ ...validClassification, outputPotentialScore: -1 })).toBe(false);
  });

  it("rejects when tags is not an array", () => {
    expect(isPostClassificationResult({ ...validClassification, tags: "AI" })).toBe(false);
  });

  it("rejects null", () => {
    expect(isPostClassificationResult(null)).toBe(false);
  });

  it("rejects missing summary", () => {
    const { summary: _, ...rest } = validClassification;
    expect(isPostClassificationResult(rest)).toBe(false);
  });

  it("accepts all valid postType values", () => {
    for (const pt of ["thought", "learning", "output_material", "unknown"]) {
      expect(isPostClassificationResult({ ...validClassification, postType: pt })).toBe(true);
    }
  });
});

describe("isGeneratedOutputResult", () => {
  it("accepts title + content", () => {
    expect(isGeneratedOutputResult({ title: "タイトル", content: "本文" })).toBe(true);
  });

  it("accepts with optional contentJson", () => {
    expect(isGeneratedOutputResult({ title: "T", content: "C", contentJson: { slides: [] } })).toBe(true);
  });

  it("rejects when content is missing", () => {
    expect(isGeneratedOutputResult({ title: "T" })).toBe(false);
  });

  it("rejects when contentJson is a non-object", () => {
    expect(isGeneratedOutputResult({ title: "T", content: "C", contentJson: "bad" })).toBe(false);
  });
});

describe("isSemanticSearchResult", () => {
  const valid = {
    results: [{ postId: "abc", relevanceScore: 0.9, reason: "related" }],
  };

  it("accepts valid result", () => {
    expect(isSemanticSearchResult(valid)).toBe(true);
  });

  it("accepts empty results array", () => {
    expect(isSemanticSearchResult({ results: [] })).toBe(true);
  });

  it("rejects when relevanceScore is not a number", () => {
    expect(
      isSemanticSearchResult({ results: [{ postId: "x", relevanceScore: "high", reason: "r" }] })
    ).toBe(false);
  });

  it("rejects when results is missing", () => {
    expect(isSemanticSearchResult({})).toBe(false);
  });
});

describe("isTrendInsight", () => {
  const valid = {
    topCategories: ["AI活用", "SNS運用"],
    favoriteThemes: ["マーケ"],
    learningStyle: "hands-on",
    strengths: ["分析力"],
    recommendedNextTopics: ["ブランディング"],
    summary: "AIと発信に強いユーザーです。",
  };

  it("accepts valid insight", () => {
    expect(isTrendInsight(valid)).toBe(true);
  });

  it("rejects when topCategories is not string array", () => {
    expect(isTrendInsight({ ...valid, topCategories: [1, 2] })).toBe(false);
  });

  it("rejects when summary is missing", () => {
    const { summary: _, ...rest } = valid;
    expect(isTrendInsight(rest)).toBe(false);
  });
});

describe("isLearningCoreOutput", () => {
  const validCore = {
    sourcePostId: "post1",
    title: "学習タイトル",
    summary: "学習の要約です。",
    originalIntent: "元の意図です。",
    capture: { items: [{ label: "ポイント", body: "内容" }] },
    steps: [{ title: "ステップ1", description: "説明", actions: ["行動1"] }],
    applicationIdeas: [{ title: "活用案", description: "説明" }],
    tips: ["ヒント1"],
    useCases: ["用例1"],
  };

  it("accepts valid core output", () => {
    expect(isLearningCoreOutput(validCore)).toBe(true);
  });

  it("accepts capture with verbatim instead of items", () => {
    expect(
      isLearningCoreOutput({ ...validCore, capture: { verbatim: "そのままの引用文" } })
    ).toBe(true);
  });

  it("rejects when capture has empty items and no verbatim", () => {
    expect(isLearningCoreOutput({ ...validCore, capture: { items: [] } })).toBe(false);
  });

  it("rejects when steps is missing", () => {
    const { steps: _, ...rest } = validCore;
    expect(isLearningCoreOutput(rest)).toBe(false);
  });
});

describe("isLearningSupplementOutput", () => {
  const validSupplement = {
    diagramStructure: {
      title: "図解タイトル",
      sections: [{ heading: "セクション1", body: "内容" }],
    },
    imageExplanationPrompt: "画像説明のプロンプト",
    userLearningMemo: "ユーザーのメモ",
    beginnerZone: null,
  };

  it("accepts valid supplement output", () => {
    expect(isLearningSupplementOutput(validSupplement)).toBe(true);
  });

  it("accepts with optional beginnerZone", () => {
    expect(
      isLearningSupplementOutput({
        ...validSupplement,
        beginnerZone: {
          stumblingPoints: [{ point: "難点", explanation: "説明" }],
          glossary: [{ term: "用語", explanation: "定義" }],
        },
      })
    ).toBe(true);
  });

  it("rejects when diagramStructure is missing", () => {
    const { diagramStructure: _, ...rest } = validSupplement;
    expect(isLearningSupplementOutput(rest)).toBe(false);
  });
});

describe("isStrictLearningOutput", () => {
  const validStrict = {
    oneLiner: "一言要約",
    whyItMatters: "重要な理由",
    prerequisites: "前提知識",
    claimBreakdown: {
      claim: "主張",
      background: "背景",
      assumption: "前提",
      evidence: "根拠",
      counterExample: "反例",
      limit: "限界",
    },
    strictLearningView: {
      positiveExamples: ["良い例"],
      negativeExamples: ["悪い例"],
      boundaryExamples: ["境界例"],
      necessaryConditions: ["必要条件"],
      typicalFeatures: ["典型的特徴"],
      essence: "本質",
    },
    abstraction: "抽象化",
    transferToOtherFields: [{ field: "分野", application: "応用" }],
    applyToYourself: "自己適用",
    fifteenMinuteExercise: {
      goal: "目標",
      steps: ["ステップ1", "ステップ2"],
      deliverable: "成果物",
    },
  };

  it("accepts valid strict output", () => {
    expect(isStrictLearningOutput(validStrict)).toBe(true);
  });

  it("rejects when oneLiner is missing", () => {
    const { oneLiner: _, ...rest } = validStrict;
    expect(isStrictLearningOutput(rest)).toBe(false);
  });

  it("rejects when transferToOtherFields item is malformed", () => {
    expect(
      isStrictLearningOutput({
        ...validStrict,
        transferToOtherFields: [{ field: "分野" }], // application missing
      })
    ).toBe(false);
  });
});

const validDecode = {
  evidenceQuotes: ["チラシやサイトのメインビジュアルにそのまま使える形に改良"],
  oneLiner: "実写広告の定番構図を穴埋め式プロンプトに実務変換した型",
  whySignificant: [
    {
      point: "鑑賞用ではなく実務用への変換をしている",
      evidence: "チラシやサイトのメインビジュアルにそのまま使える形に改良",
    },
  ],
  beforeAfter: {
    before: "小規模店はプロ発注かストックフォトで妥協するしかなかった",
    trigger: "話題の構図が穴埋めプロンプト化された",
    after: "個人経営の飲食店が広告グレードのビジュアルを内製できる",
  },
  mechanism: {
    items: [{ element: "white seamless background", role: "切り抜き・文字載せのための白ホリ指定" }],
    lineage: "@azed_ai の海外作例が原典",
  },
  extractedPattern: {
    name: "浮遊デコンストラクト広告型",
    structure: "[被写体] + ジャンル宣言 + 背景 + ライティング + 構図トリック",
    variableSlots: ["subject", "ingredient_bits"],
    transferScope: "構成要素に分解できるプロダクト全般",
    usageNote: null,
  },
  synthesisTags: ["プロンプト設計", "商用ビジュアル"],
  outputSeed: { angle: "before/after を導入に使う切り口", hook: null },
};

describe("isDecodeOutput", () => {
  it("accepts a full valid decode", () => {
    expect(isDecodeOutput(validDecode)).toBe(true);
  });

  it("accepts when peripheral fields are missing (core only)", () => {
    expect(
      isDecodeOutput({
        oneLiner: validDecode.oneLiner,
        whySignificant: validDecode.whySignificant,
        beforeAfter: validDecode.beforeAfter,
      })
    ).toBe(true);
  });

  it("accepts null mechanism / extractedPattern", () => {
    expect(isDecodeOutput({ ...validDecode, mechanism: null, extractedPattern: null })).toBe(true);
  });

  it("rejects empty oneLiner", () => {
    expect(isDecodeOutput({ ...validDecode, oneLiner: "  " })).toBe(false);
  });

  it("rejects empty whySignificant array", () => {
    expect(isDecodeOutput({ ...validDecode, whySignificant: [] })).toBe(false);
  });

  it("rejects whySignificant entries without evidence", () => {
    expect(
      isDecodeOutput({ ...validDecode, whySignificant: [{ point: "根拠なしのすごい" }] })
    ).toBe(false);
  });

  it("rejects incomplete beforeAfter", () => {
    expect(
      isDecodeOutput({ ...validDecode, beforeAfter: { before: "今まで", after: "こう変わる" } })
    ).toBe(false);
  });

  it("rejects malformed mechanism items", () => {
    expect(
      isDecodeOutput({
        ...validDecode,
        mechanism: { items: [{ element: "x" }], lineage: null }, // role missing
      })
    ).toBe(false);
  });

  it("rejects malformed extractedPattern", () => {
    expect(
      isDecodeOutput({
        ...validDecode,
        extractedPattern: { name: "型", structure: "構造" }, // variableSlots / transferScope missing
      })
    ).toBe(false);
  });

  it("rejects the review-pass ok response ({\"ok\": true})", () => {
    expect(isDecodeOutput({ ok: true })).toBe(false);
  });

  it("rejects null", () => {
    expect(isDecodeOutput(null)).toBe(false);
  });
});
