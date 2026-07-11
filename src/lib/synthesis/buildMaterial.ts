import type { DecodeOutput, LearningOutput, SynthesisMaterial } from "@/lib/ai/types";

export interface SynthesisCardSource {
  title: string;
  outputJson: string;
}

export interface SynthesisPatternSource {
  name: string;
  structure: string;
  transferScope: string;
  tagsJson: string;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function parseLearningOutput(outputJson: string): LearningOutput | null {
  try {
    const parsed = JSON.parse(outputJson);
    return typeof parsed === "object" && parsed !== null ? (parsed as LearningOutput) : null;
  } catch {
    return null;
  }
}

export function getDecode(outputJson: string): DecodeOutput | null {
  return parseLearningOutput(outputJson)?.decode ?? null;
}

export function buildCardMaterial(card: SynthesisCardSource): SynthesisMaterial | null {
  const decode = getDecode(card.outputJson);
  if (!decode) return null;

  const beforeAfter = decode.beforeAfter
    ? `「${decode.beforeAfter.before} → ${decode.beforeAfter.trigger} → ${decode.beforeAfter.after}」`
    : "";
  const patternSummary = decode.extractedPattern
    ? `${decode.extractedPattern.name}: ${decode.extractedPattern.structure}`
    : null;

  return {
    kind: "card",
    title: card.title,
    oneLiner: decode.oneLiner,
    beforeAfter,
    patternSummary,
    tags: decode.synthesisTags ?? [],
    outputSeedAngle: decode.outputSeed?.angle ?? null,
  };
}

export function buildPatternMaterial(asset: SynthesisPatternSource): SynthesisMaterial {
  return {
    kind: "pattern",
    title: asset.name,
    oneLiner: asset.structure,
    beforeAfter: "",
    patternSummary: `${asset.name}: ${asset.structure}（転用範囲: ${asset.transferScope}）`,
    tags: parseJsonArray(asset.tagsJson),
    outputSeedAngle: null,
  };
}
