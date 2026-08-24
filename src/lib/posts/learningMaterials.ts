import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type {
  LearningGenerationMetadata,
  LearningMaterial,
  LearningMaterialKind,
  LearningOutput,
  LearningSourceEvidence,
} from "@/lib/ai/types";
import { fetchArticlePreview } from "@/lib/fetchArticle";
import { describeImageUrl } from "@/lib/posts/imageVision";
import { mergeArticleCardJson, parseArticleContent } from "@/lib/posts/articleParser";
import {
  enrichPostRelatedLinks,
  gatherUrlsFromPost,
  readRelatedLinks,
  type RelatedLink,
} from "@/lib/posts/relatedLinks";
import { parseMedia, type PostForLearning } from "@/lib/posts/learningSource";

const URL_ONLY_RE = /^https?:\/\/\S+$/;
const X_ARTICLE_RE = /(?:x|twitter)\.com\/i\/article\//i;
const MAIN_SOURCE_KINDS = new Set<LearningMaterialKind>([
  "image",
  "video_transcript",
  "article",
  "related_link",
]);

export interface MissingLearningSource {
  sourceId: string;
  kind: LearningMaterialKind;
  label: string;
  reason: string;
}

export class LearningMaterialsIncompleteError extends Error {
  readonly code = "LEARNING_MATERIALS_INCOMPLETE" as const;
  readonly missingSources: MissingLearningSource[];
  readonly materials: LearningMaterial[];

  constructor(missingSources: MissingLearningSource[], materials: LearningMaterial[]) {
    super("学習カードを生成するための補助情報が不足しています");
    this.name = "LearningMaterialsIncompleteError";
    this.missingSources = missingSources;
    this.materials = materials;
  }
}

type MaterialPost = Pick<
  PostForLearning,
  "id" | "text" | "translatedText" | "mediaJson" | "urlCardJson" | "videoTranscriptText"
> & {
  threadPosts: Array<Pick<PostForLearning["threadPosts"][number], "id" | "text" | "translatedText" | "mediaJson" | "threadOrder">>;
};

function cleanText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function materialText(text: string, translatedText?: string | null): string {
  const original = cleanText(text);
  const translated = cleanText(translatedText);
  return translated ? `${original}\n日本語訳: ${translated}` : original;
}

function inferArticleQuality(card: ReturnType<typeof parseArticleContent>): LearningMaterial["quality"] {
  if (card.pastedByUser && card.pastedContent) return "full";
  if (card.contentQuality === "full" || card.contentQuality === "summary" || card.contentQuality === "metadata_only") {
    return card.contentQuality;
  }
  if (card.description && card.description.length >= 1000) return "full";
  if (card.description) return "summary";
  return "metadata_only";
}

function articleContent(card: ReturnType<typeof parseArticleContent>): string {
  return cleanText(card.pastedContent) || cleanText(card.description);
}

function linkContent(link: RelatedLink): string {
  return [link.title, link.description].filter((value): value is string => Boolean(cleanText(value))).join("\n");
}

function linkQuality(link: RelatedLink): LearningMaterial["quality"] {
  if (link.quality === "full" || link.quality === "summary" || link.quality === "metadata_only") {
    return link.quality;
  }
  return link.description && link.description.length >= 1000 ? "full" : link.description ? "summary" : "metadata_only";
}

function qualityRank(quality: LearningMaterial["quality"]): number {
  return quality === "full" ? 3 : quality === "summary" ? 2 : quality === "metadata_only" ? 1 : 0;
}

function imageMediaSource(media: ReturnType<typeof parseMedia>[number]): string {
  return media.url || media.thumbnailUrl || "";
}

function getMainUrl(post: MaterialPost, card: ReturnType<typeof parseArticleContent>): string | null {
  if (card.expandedUrl) return card.expandedUrl;
  const text = cleanText(post.text);
  return URL_ONLY_RE.test(text) ? text : null;
}

/**
 * DBに保存された状態から、ネットワークやAI呼び出しを発生させずに素材一覧を作る。
 * confirm画面と学習GETの表示、生成前の最終判定で同じ関数を使う。
 */
export function buildLearningMaterialSnapshot(post: MaterialPost): LearningMaterial[] {
  const materials: LearningMaterial[] = [
    {
      id: `post:${post.id}`,
      kind: "post",
      label: "投稿本文",
      content: materialText(post.text, post.translatedText),
      status: cleanText(post.text) ? "ready" : "missing",
      reason: cleanText(post.text) ? undefined : "投稿本文がありません",
    },
  ];

  const threadPosts = [...(post.threadPosts ?? [])].sort((a, b) => a.threadOrder - b.threadOrder);
  threadPosts.forEach((thread, index) => {
    const content = materialText(thread.text, thread.translatedText);
    materials.push({
      id: `thread:${thread.id}`,
      kind: "thread",
      label: `ツリー${index + 1}`,
      content,
      status: content ? "ready" : "missing",
      reason: content ? undefined : "ツリー本文がありません",
    });
  });

  const mediaGroups = [
    { media: parseMedia(post.mediaJson), prefix: `image:${post.id}`, labelPrefix: "画像" },
    ...threadPosts.map((thread) => ({
      media: parseMedia(thread.mediaJson),
      prefix: `image:${thread.id}`,
      labelPrefix: `ツリー${thread.threadOrder + 1}の画像`,
    })),
  ];
  let imageIndex = 0;
  let videoIndex = 0;
  for (const group of mediaGroups) {
    for (const media of group.media) {
      const url = imageMediaSource(media);
      if (media.type === "image" || media.type === "gif") {
        imageIndex += 1;
        const content = cleanText(media.description);
        materials.push({
          id: `${group.prefix}:${imageIndex}`,
          kind: "image",
          label: `${group.labelPrefix}${imageIndex}`,
          url,
          content,
          status: content ? "ready" : media.analysisError ? "failed" : "missing",
          reason: content ? undefined : media.analysisError || "画像の読み取り結果がありません",
          quality: content ? "full" : undefined,
        });
      } else if (media.type === "video") {
        videoIndex += 1;
        const transcript = cleanText(post.videoTranscriptText);
        materials.push({
          id: `video:${post.id}:${videoIndex}`,
          kind: "video_transcript",
          label: `添付動画${videoIndex}`,
          url,
          content: transcript,
          status: transcript ? "ready" : "missing",
          quality: transcript ? "full" : undefined,
          reason: transcript ? undefined : "動画の文字起こしがありません。内容を確認して文字起こしを入力してください",
        });
      }
    }
  }

  if (videoIndex === 0 && cleanText(post.videoTranscriptText)) {
    materials.push({
      id: `video:${post.id}:transcript`,
      kind: "video_transcript",
      label: "動画文字起こし",
      content: cleanText(post.videoTranscriptText),
      status: "ready",
      quality: "full",
    });
  }

  const card = parseArticleContent(post.urlCardJson);
  const mainUrl = getMainUrl(post, card);
  if (mainUrl) {
    const content = articleContent(card);
    const quality = inferArticleQuality(card);
    const isXArticle = X_ARTICLE_RE.test(mainUrl) || card.isXArticle;
    materials.push({
      id: `article:${mainUrl}`,
      kind: "article",
      label: "記事URL",
      url: mainUrl,
      content,
      status: content && quality !== "metadata_only" ? "ready" : "missing",
      quality,
      reason:
        content && quality !== "metadata_only"
          ? undefined
          : isXArticle
            ? "X Article本文を取得できません。本文を貼り付けてください"
            : "記事本文が未取得です。本文を取得するか貼り付けてください",
    });
  }

  const relatedLinks = readRelatedLinks(post.urlCardJson);
  const relatedByUrl = new Map(relatedLinks.map((link) => [link.url, link]));
  const mainUrlForCompare = mainUrl ? mainUrl : null;
  const allRelatedUrls = new Set<string>();
  const allText = [post.text, ...threadPosts.map((thread) => thread.text)].join("\n");
  for (const raw of allText.match(/https?:\/\/[^\s)>"'】]+/gi) ?? []) {
    const normalized = raw.replace(/[).,;:'"]+$/, "");
    if (normalized && normalized !== mainUrlForCompare && !X_ARTICLE_RE.test(normalized)) allRelatedUrls.add(normalized);
  }
  for (const link of relatedLinks) {
    if (link.url !== mainUrlForCompare && !X_ARTICLE_RE.test(link.url)) allRelatedUrls.add(link.url);
  }
  let relatedIndex = 0;
  for (const url of allRelatedUrls) {
    relatedIndex += 1;
    const link = relatedByUrl.get(url);
    const content = link ? linkContent(link) : "";
    const quality = link ? linkQuality(link) : undefined;
    const failed = link?.status === "failed";
    materials.push({
      id: `related:${url}`,
      kind: "related_link",
      label: `関連リンク${relatedIndex}`,
      url,
      content,
      status: content && quality !== "metadata_only" && !failed ? "ready" : failed ? "failed" : "missing",
      quality,
      reason: content && quality !== "metadata_only" && !failed ? undefined : link?.reason || "関連リンクの内容を取得できていません",
    });
  }

  return materials;
}

export function fingerprintLearningMaterials(materials: LearningMaterial[]): string {
  const normalized = materials.map(({ id, kind, label, url, content, status, quality }) => ({
    id,
    kind,
    label,
    url: url || null,
    content,
    status,
    quality: quality || null,
  }));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function evidenceQuote(content: string): string | undefined {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > 180 ? `${normalized.slice(0, 180)}…` : normalized;
}

export function buildLearningSourceEvidence(
  materials: LearningMaterial[],
  excludedSourceIds: string[] = [],
): LearningSourceEvidence[] {
  const excluded = new Set(excludedSourceIds);
  return materials.map((material) => {
    const usable = material.status === "ready" && Boolean(material.content.trim());
    return {
      sourceId: material.id,
      label: material.label,
      kind: material.kind,
      used: usable,
      quote: usable ? evidenceQuote(material.content) : undefined,
      reason: usable ? undefined : excluded.has(material.id) ? "未取得のため、ユーザーの指定によりこの生成では除外しました" : material.reason || "この素材は生成に使用できませんでした",
      status: material.status,
      quality: material.quality,
    };
  });
}

export function buildLearningGenerationMetadata(
  materials: LearningMaterial[],
  generatedAt = new Date().toISOString(),
  options: { excludedSourceIds?: string[] } = {},
): LearningGenerationMetadata {
  return {
    version: 1,
    materialFingerprint: fingerprintLearningMaterials(materials),
    sources: buildLearningSourceEvidence(materials, options.excludedSourceIds),
    generatedAt,
    ...(options.excludedSourceIds && options.excludedSourceIds.length > 0
      ? { excludedSourceIds: options.excludedSourceIds }
      : {}),
  };
}

export function attachLearningMetadata(
  output: LearningOutput,
  materials: LearningMaterial[],
  generatedAt = new Date().toISOString(),
  options: { excludedSourceIds?: string[] } = {},
): LearningOutput {
  return { ...output, learningMetadata: buildLearningGenerationMetadata(materials, generatedAt, options) };
}

export function readLearningGenerationMetadata(outputJson: string | null | undefined): LearningGenerationMetadata | null {
  if (!outputJson) return null;
  try {
    const parsed = JSON.parse(outputJson) as { learningMetadata?: LearningGenerationMetadata };
    const metadata = parsed.learningMetadata;
    if (!metadata || metadata.version !== 1 || typeof metadata.materialFingerprint !== "string" || !Array.isArray(metadata.sources)) {
      return null;
    }
    return metadata;
  } catch {
    return null;
  }
}

export function getLearningCardStatus(
  learningCard: { outputJson?: string | null } | null | undefined,
  materials: LearningMaterial[],
) {
  const currentFingerprint = fingerprintLearningMaterials(materials);
  const metadata = readLearningGenerationMetadata(learningCard?.outputJson);
  const hasAuxiliaryMaterial = materials.some((material) => MAIN_SOURCE_KINDS.has(material.kind));
  const stale = Boolean(
    learningCard &&
      (!metadata
        ? hasAuxiliaryMaterial
        : metadata.materialFingerprint !== currentFingerprint),
  );
  return {
    isStale: stale,
    materialFingerprint: currentFingerprint,
    generatedFingerprint: metadata?.materialFingerprint || null,
    materials,
    missingSources: materials
      .filter((material) => MAIN_SOURCE_KINDS.has(material.kind) && material.status !== "ready")
      .map((material) => ({
        sourceId: material.id,
        kind: material.kind,
        label: material.label,
        reason: material.reason || "内容が取得できていません",
      })),
    excludedSourceIds: metadata?.excludedSourceIds || [],
  };
}

async function updateMediaDescription(
  postId: string,
  mediaJson: string | null,
  force: boolean,
): Promise<{ json: string | null; changed: boolean; analyzedCount: number; skippedCount: number; failures: number }> {
  if (!mediaJson) return { json: mediaJson, changed: false, analyzedCount: 0, skippedCount: 0, failures: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(mediaJson);
  } catch {
    return { json: mediaJson, changed: false, analyzedCount: 0, skippedCount: 0, failures: 0 };
  }
  if (!Array.isArray(parsed)) return { json: mediaJson, changed: false, analyzedCount: 0, skippedCount: 0, failures: 0 };

  let changed = false;
  let analyzedCount = 0;
  let skippedCount = 0;
  let failures = 0;
  for (const item of parsed as Array<Record<string, unknown>>) {
    if (!item || typeof item !== "object") continue;
    const type = item.type;
    const src = type === "photo" ? item.url || item.previewUrl : type === "animated_gif" ? item.previewUrl || item.url : null;
    if (typeof src !== "string" || !src) continue;
    const existing = typeof item.description === "string" ? item.description.trim() : "";
    if (existing && !force) {
      skippedCount += 1;
      continue;
    }
    try {
      const description = (await describeImageUrl(src)).trim();
      if (!description) throw new Error("画像の内容を読み取れませんでした");
      item.description = description;
      delete item.analysisError;
      changed = true;
      analyzedCount += 1;
    } catch (error) {
      failures += 1;
      item.analysisError = error instanceof Error ? error.message : "画像の読み取りに失敗しました";
      changed = true;
    }
  }
  return { json: changed ? JSON.stringify(parsed) : mediaJson, changed, analyzedCount, skippedCount, failures };
}

/** 既存の手動画像解析APIと学習生成前処理が共有する画像解析処理。 */
export async function analyzePostImages(postId: string, force = false) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { threadPosts: { orderBy: { threadOrder: "asc" } } },
  });
  if (!post) throw new Error("投稿が見つかりません");

  let analyzedCount = 0;
  let skippedCount = 0;
  let failures = 0;
  const images: { url: string; description: string; error?: string }[] = [];

  const main = await updateMediaDescription(post.id, post.mediaJson, force);
  analyzedCount += main.analyzedCount;
  skippedCount += main.skippedCount;
  failures += main.failures;
  if (main.changed) await prisma.post.update({ where: { id: post.id }, data: { mediaJson: main.json } });

  for (const thread of post.threadPosts) {
    const result = await updateMediaDescription(thread.id, thread.mediaJson, force);
    analyzedCount += result.analyzedCount;
    skippedCount += result.skippedCount;
    failures += result.failures;
    if (result.changed) await prisma.threadPost.update({ where: { id: thread.id }, data: { mediaJson: result.json } });
  }

  const updated = await prisma.post.findUnique({
    where: { id: postId },
    include: { threadPosts: { orderBy: { threadOrder: "asc" } } },
  });
  return { post: updated, analyzedCount, skippedCount, failures, images };
}

async function prepareArticle(post: MaterialPost): Promise<void> {
  const card = parseArticleContent(post.urlCardJson);
  const url = getMainUrl(post, card);
  if (!url || X_ARTICLE_RE.test(url)) return;

  const quality = inferArticleQuality(card);
  if (quality === "full") return;

  try {
    const preview = await fetchArticlePreview(url);
    if (!preview.title && !preview.description) return;
    const nextQuality = qualityRank(preview.quality) >= qualityRank(quality) ? preview.quality : quality;
    const incoming: Record<string, unknown> = {
      expandedUrl: card.expandedUrl ?? url,
      title: preview.title ?? card.title,
      description: qualityRank(preview.quality) >= qualityRank(quality) ? preview.description ?? card.description : card.description,
      imageUrl: preview.imageUrl ?? card.imageUrl,
      contentQuality: nextQuality ?? quality,
      pastedByUser: card.pastedByUser,
    };
    if (card.pastedContent) incoming.pastedContent = card.pastedContent;
    await prisma.post.update({
      where: { id: post.id },
      data: { urlCardJson: mergeArticleCardJson(post.urlCardJson, incoming) },
    });
  } catch (error) {
    console.warn("[learningMaterials] article preparation failed:", error instanceof Error ? error.message : error);
  }
}

/** 生成APIの前段で補助情報を取得・保存し、未取得なら例外にする。 */
export async function prepareLearningMaterials(postId: string, options: { allowIncomplete?: boolean } = {}): Promise<{
  post: PostForLearning;
  materials: LearningMaterial[];
  excludedSourceIds: string[];
}> {
  const initial = await prisma.post.findUnique({
    where: { id: postId },
    include: { classification: true, threadPosts: { orderBy: { threadOrder: "asc" } }, learningCard: true },
  });
  if (!initial) throw new Error("投稿が見つかりません");

  try {
    await analyzePostImages(postId, false);
  } catch (error) {
    console.warn("[learningMaterials] image preparation failed:", error instanceof Error ? error.message : error);
  }

  let current = await prisma.post.findUnique({
    where: { id: postId },
    include: { classification: true, threadPosts: { orderBy: { threadOrder: "asc" } }, learningCard: true },
  });
  if (!current) throw new Error("投稿が見つかりません");
  await prepareArticle(current);

  try {
    const urls = await gatherUrlsFromPost(postId);
    if (urls.length > 0) await enrichPostRelatedLinks(postId, { max: 12 });
  } catch (error) {
    console.warn("[learningMaterials] related link preparation failed:", error instanceof Error ? error.message : error);
  }

  current = await prisma.post.findUnique({
    where: { id: postId },
    include: { classification: true, threadPosts: { orderBy: { threadOrder: "asc" } }, learningCard: true },
  });
  if (!current) throw new Error("投稿が見つかりません");
  const materials = buildLearningMaterialSnapshot(current);
  const missingSources = materials
    .filter((material) => MAIN_SOURCE_KINDS.has(material.kind) && material.status !== "ready")
    .map((material) => ({
      sourceId: material.id,
      kind: material.kind,
      label: material.label,
      reason: material.reason || "内容を取得できていません",
    }));
  if (missingSources.length > 0 && !options.allowIncomplete) {
    throw new LearningMaterialsIncompleteError(missingSources, materials);
  }
  const excludedSourceIds = options.allowIncomplete ? missingSources.map((source) => source.sourceId) : [];
  return { post: current, materials, excludedSourceIds };
}
