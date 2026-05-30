import type {
  GeneratedOutputResult,
  LearningOutput,
  PostClassificationResult,
  SemanticSearchResult,
  StrictLearningOutput,
  TrendInsight,
} from "./types";

const postTypes = ["thought", "learning", "output_material", "unknown"];
const difficultyLevels = ["beginner", "intermediate", "advanced", "unknown"];

export function isPostClassificationResult(
  value: unknown
): value is PostClassificationResult {
  if (!isRecord(value)) return false;
  return (
    isOneOf(value.postType, postTypes) &&
    typeof value.primaryCategory === "string" &&
    isStringArray(value.tags) &&
    typeof value.summary === "string" &&
    typeof value.recommendReason === "string" &&
    isOneOf(value.difficultyLevel, difficultyLevels) &&
    isScore(value.thinkingPotentialScore) &&
    isScore(value.learningPotentialScore) &&
    isScore(value.outputPotentialScore) &&
    typeof value.recommendedMode === "string"
  );
}

export function isGeneratedOutputResult(
  value: unknown
): value is GeneratedOutputResult {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    (value.contentJson === undefined || isRecord(value.contentJson))
  );
}

export function isTranslatedTextResult(value: unknown): value is { translatedText: string } {
  return isRecord(value) && typeof value.translatedText === "string";
}

export function isSemanticSearchResult(value: unknown): value is SemanticSearchResult {
  if (!isRecord(value) || !Array.isArray(value.results)) return false;
  return value.results.every(
    (r) =>
      isRecord(r) &&
      typeof r.postId === "string" &&
      typeof r.relevanceScore === "number" &&
      typeof r.reason === "string"
  );
}

export function isTrendInsight(value: unknown): value is TrendInsight {
  if (!isRecord(value)) return false;
  return (
    isStringArray(value.topCategories) &&
    isStringArray(value.favoriteThemes) &&
    typeof value.learningStyle === "string" &&
    isStringArray(value.strengths) &&
    isStringArray(value.recommendedNextTopics) &&
    typeof value.summary === "string"
  );
}

export function isLearningOutput(value: unknown): value is LearningOutput {
  if (!isRecord(value) || !isRecord(value.diagramStructure)) return false;

  return (
    typeof value.sourcePostId === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.originalIntent === "string" &&
    isValidCapture(value.capture) &&
    Array.isArray(value.steps) &&
    value.steps.every((step) => {
      if (!isRecord(step)) return false;
      return (
        typeof step.title === "string" &&
        typeof step.description === "string" &&
        isStringArray(step.actions)
      );
    }) &&
    isLabelDescriptionArray(value.applicationIdeas, "title") &&
    isStringArray(value.tips) &&
    isStringArray(value.useCases) &&
    isValidBeginnerZone(value.beginnerZone) &&
    typeof value.diagramStructure.title === "string" &&
    Array.isArray(value.diagramStructure.sections) &&
    value.diagramStructure.sections.every((section) => {
      if (!isRecord(section)) return false;
      return (
        typeof section.heading === "string" &&
        typeof section.body === "string" &&
        (section.visualIdea === undefined || typeof section.visualIdea === "string")
      );
    }) &&
    typeof value.imageExplanationPrompt === "string" &&
    typeof value.userLearningMemo === "string" &&
    (value.status === "draft" || value.status === "saved")
  );
}

/** ① capture（投稿の中身）：items が1件以上 か verbatim が非空文字列 のどちらかを満たす */
function isValidCapture(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasItems =
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    value.items.every(
      (it) => isRecord(it) && typeof it.label === "string" && typeof it.body === "string"
    );
  const hasVerbatim = typeof value.verbatim === "string" && value.verbatim.trim().length > 0;
  return hasItems || hasVerbatim;
}

/** ③ 初心者ゾーン：任意。存在する場合のみ形を緩くチェックする */
function isValidBeginnerZone(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (!isRecord(value)) return false;
  const stumblingOk =
    value.stumblingPoints === undefined ||
    (Array.isArray(value.stumblingPoints) &&
      value.stumblingPoints.every(
        (s) => isRecord(s) && typeof s.point === "string" && typeof s.explanation === "string"
      ));
  const glossaryOk =
    value.glossary === undefined ||
    (Array.isArray(value.glossary) &&
      value.glossary.every(
        (g) => isRecord(g) && typeof g.term === "string" && typeof g.explanation === "string"
      ));
  return stumblingOk && glossaryOk;
}

export function isStrictLearningOutput(value: unknown): value is StrictLearningOutput {
  if (!isRecord(value)) return false;
  if (!isRecord(value.claimBreakdown)) return false;
  if (!isRecord(value.strictLearningView)) return false;
  if (!isRecord(value.fifteenMinuteExercise)) return false;
  if (!Array.isArray(value.transferToOtherFields)) return false;

  const cb = value.claimBreakdown;
  const sv = value.strictLearningView;
  const ex = value.fifteenMinuteExercise;

  return (
    typeof value.oneLiner === "string" &&
    typeof value.whyItMatters === "string" &&
    typeof value.prerequisites === "string" &&
    typeof cb.claim === "string" &&
    typeof cb.background === "string" &&
    typeof cb.assumption === "string" &&
    typeof cb.evidence === "string" &&
    typeof cb.counterExample === "string" &&
    typeof cb.limit === "string" &&
    isStringArray(sv.positiveExamples) &&
    isStringArray(sv.negativeExamples) &&
    isStringArray(sv.boundaryExamples) &&
    isStringArray(sv.necessaryConditions) &&
    isStringArray(sv.typicalFeatures) &&
    typeof sv.essence === "string" &&
    typeof value.abstraction === "string" &&
    value.transferToOtherFields.every(
      (t) => isRecord(t) && typeof t.field === "string" && typeof t.application === "string"
    ) &&
    typeof value.applyToYourself === "string" &&
    typeof ex.goal === "string" &&
    isStringArray(ex.steps) &&
    typeof ex.deliverable === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isOneOf(value: unknown, choices: string[]): value is string {
  return typeof value === "string" && choices.includes(value);
}

function isLabelDescriptionArray(value: unknown, labelKey: "label" | "title" = "label"): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!isRecord(item)) return false;
      return typeof item[labelKey] === "string" && typeof item.description === "string";
    })
  );
}
