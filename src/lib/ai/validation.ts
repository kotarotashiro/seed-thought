import type {
  GeneratedDeepDiveSessionResult,
  GeneratedOutputResult,
  PostClassificationResult,
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
