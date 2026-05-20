import type {
  GeneratedDeepDiveSessionResult,
  GeneratedOutputResult,
  LearningOutput,
  PostClassificationResult,
  SemanticSearchResult,
  TrendInsight,
} from "./types";

const postTypes = ["thought", "learning", "output_material", "unknown"];
const difficultyLevels = ["beginner", "intermediate", "advanced", "unknown"];
const recommendationModes = ["thought_lens", "learning_lesson", "unknown"];

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
    isOneOf(value.recommendedMode, recommendationModes)
  );
}

export function isGeneratedDeepDiveSessionResult(
  value: unknown
): value is GeneratedDeepDiveSessionResult {
  if (!isRecord(value) || !Array.isArray(value.steps) || value.steps.length === 0) {
    return false;
  }

  return value.steps.every((step) => {
    if (!isRecord(step) || !isRecord(step.aiContent)) return false;
    return (
      typeof step.stepIndex === "number" &&
      typeof step.stepKey === "string" &&
      typeof step.title === "string" &&
      typeof step.question === "string" &&
      typeof step.aiContent.explanation === "string" &&
      (step.aiContent.keyPoints === undefined || isStringArray(step.aiContent.keyPoints)) &&
      (step.aiContent.examples === undefined || isStringArray(step.aiContent.examples)) &&
      (step.aiContent.promptForUser === undefined ||
        typeof step.aiContent.promptForUser === "string")
    );
  });
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
    typeof value.whatIsInteresting === "string" &&
    typeof value.coreInsight === "string" &&
    isLabelDescriptionArray(value.structure) &&
    Array.isArray(value.steps) &&
    value.steps.every((step) => {
      if (!isRecord(step)) return false;
      return (
        typeof step.title === "string" &&
        typeof step.description === "string" &&
        isStringArray(step.actions)
      );
    }) &&
    typeof value.manual === "string" &&
    isLabelDescriptionArray(value.applicationIdeas, "title") &&
    isStringArray(value.tips) &&
    isStringArray(value.useCases) &&
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
