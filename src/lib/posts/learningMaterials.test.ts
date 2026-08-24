import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningMaterial } from "@/lib/ai/types";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/fetchArticle", () => ({ fetchArticlePreview: vi.fn() }));
vi.mock("@/lib/posts/imageVision", () => ({ describeImageUrl: vi.fn() }));
vi.mock("@/lib/profile/fixedProfile", () => ({
  getProfile: vi.fn(async () => ({ themes: [], knowledge: "" })),
}));
vi.mock("@/lib/posts/relatedLinks", () => ({
  enrichPostRelatedLinks: vi.fn(),
  gatherUrlsFromPost: vi.fn(async () => []),
  readRelatedLinks: (json: string | null | undefined) => {
    try {
      const parsed = json ? JSON.parse(json) : {};
      return Array.isArray(parsed.relatedLinks) ? parsed.relatedLinks : [];
    } catch {
      return [];
    }
  },
}));
vi.mock("@/lib/posts/learningSource", () => ({
  parseMedia: (json: string | null | undefined) => {
    try {
      return JSON.parse(json || "[]").map((item: Record<string, unknown>) => ({
        type: item.type === "photo" ? "image" : item.type === "video" ? "video" : "gif",
        url: typeof item.url === "string" ? item.url : "",
        thumbnailUrl: typeof item.previewUrl === "string" ? item.previewUrl : undefined,
        description: typeof item.description === "string" ? item.description : undefined,
        analysisError: typeof item.analysisError === "string" ? item.analysisError : undefined,
      }));
    } catch {
      return [];
    }
  },
}));

import {
  buildLearningMaterialSnapshot,
  buildLearningSourceEvidence,
  fingerprintLearningMaterials,
  getLearningCardStatus,
} from "@/lib/posts/learningMaterials";
import {
  buildDecodePrompt,
  buildDecodeReviewPrompt,
  buildLearningCorePrompt,
  buildLearningSupplementPrompt,
  buildStrictLearningPrompt,
} from "@/lib/ai/prompts";

const materials: LearningMaterial[] = [
  { id: "post:p1", kind: "post", label: "投稿本文", content: "本文固有文字列", status: "ready" },
  { id: "thread:t1", kind: "thread", label: "ツリー1", content: "ツリー固有文字列", status: "ready" },
  { id: "image:p1:1", kind: "image", label: "画像1", content: "画像固有文字列", status: "ready", quality: "full" },
  { id: "video:p1:1", kind: "video_transcript", label: "添付動画1", content: "動画固有文字列", status: "ready", quality: "full" },
  { id: "article:https://example.com", kind: "article", label: "記事URL", content: "記事固有文字列", status: "ready", quality: "full" },
  { id: "related:https://related.example.com", kind: "related_link", label: "関連リンク1", content: "関連リンク固有文字列", status: "ready", quality: "summary" },
];

const sourceInput = {
  id: "p1",
  authorName: "投稿者",
  authorHandle: "author",
  text: "本文固有文字列",
  postUrl: "https://x.com/example/1",
  media: [],
  learningMaterials: materials,
};

describe("learning materials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("全学習プロンプトが同じ素材集合の固有内容を参照する", async () => {
    const prompts = [
      buildLearningCorePrompt(sourceInput),
      buildLearningSupplementPrompt(sourceInput),
      buildDecodePrompt(sourceInput),
      buildDecodeReviewPrompt("{}", sourceInput),
      await buildStrictLearningPrompt({
        postText: sourceInput.text,
        classification: { primaryCategory: "テスト", summary: "テスト" },
        learningMaterials: materials,
      }),
    ];

    for (const prompt of prompts) {
      for (const material of materials) {
        expect(prompt).toContain(material.content);
      }
    }
  });

  it("素材の変更でstaleになり、旧カードに素材メタデータがなければ補助情報ありとしてstaleになる", () => {
    const currentFingerprint = fingerprintLearningMaterials(materials);
    const card = {
      outputJson: JSON.stringify({
        learningMetadata: {
          version: 1,
          materialFingerprint: currentFingerprint,
          sources: [],
          generatedAt: "2026-08-03T00:00:00.000Z",
        },
      }),
    };
    expect(getLearningCardStatus(card, materials).isStale).toBe(false);
    expect(
      getLearningCardStatus(card, materials.map((item) => item.id === "image:p1:1" ? { ...item, content: "画像更新文字列" } : item)).isStale,
    ).toBe(true);
    expect(getLearningCardStatus({ outputJson: "{}" }, materials).isStale).toBe(true);
  });

  it("未取得の動画や画像はused=falseで、通常生成に使える根拠を作らない", () => {
    const incomplete = buildLearningMaterialSnapshot({
      id: "p1",
      text: "投稿本文",
      translatedText: null,
      mediaJson: JSON.stringify([{ type: "video", url: "https://video.example/v.mp4" }, { type: "photo", url: "https://image.example/a.jpg" }]),
      urlCardJson: JSON.stringify({ expandedUrl: "https://example.com/article", title: "タイトル", description: "概要", contentQuality: "metadata_only" }),
      videoTranscriptText: null,
      threadPosts: [],
    });
    const missing = incomplete.filter((item) => item.status !== "ready");
    expect(missing.map((item) => item.kind)).toEqual(expect.arrayContaining(["image", "video_transcript", "article"]));
    const evidence = buildLearningSourceEvidence(incomplete);
    expect(evidence.filter((item) => !item.used).every((item) => !item.quote)).toBe(true);
  });
});
