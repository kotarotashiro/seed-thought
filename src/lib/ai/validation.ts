import type {
  DecodeOutput,
  GeneratedOutputResult,
  LearningOutput,
  NoteSection,
  PostClassificationResult,
  SemanticSearchResult,
  SeminarContent,
  SeminarDesign,
  StrictLearningOutput,
  SynthesisOutput,
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

export function isNoteSectionArray(value: unknown): value is NoteSection[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.heading === "string" &&
        typeof item.body === "string"
    )
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

/** 学習カード本体（A: 並列2分割の本体側）。中身そのもの＋実践材料のみを検証する。 */
export type LearningCoreOutput = Pick<
  LearningOutput,
  | "sourcePostId"
  | "title"
  | "summary"
  | "originalIntent"
  | "whyForYou"
  | "capture"
  | "steps"
  | "applicationIdeas"
  | "tips"
  | "useCases"
>;

/** 学習カード補足（A: 並列2分割の補足側）。初心者ゾーン・図解・周辺情報。 */
export type LearningSupplementOutput = Pick<
  LearningOutput,
  | "beginnerZone"
  | "diagramStructure"
  | "imageExplanationPrompt"
  | "userLearningMemo"
  | "backgroundContext"
>;

export function isLearningCoreOutput(value: unknown): value is LearningCoreOutput {
  if (!isRecord(value)) return false;
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
    isStringArray(value.useCases)
  );
}

/** 補足側の検証。diagramStructure は必須形だが、beginnerZone/backgroundContext は任意。 */
export function isLearningSupplementOutput(value: unknown): value is LearningSupplementOutput {
  if (!isRecord(value) || !isRecord(value.diagramStructure)) return false;
  return (
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
    isValidBeginnerZone(value.beginnerZone)
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

/**
 * 解読器出力の検証。
 * 核フィールド（oneLiner / whySignificant / beforeAfter）は厳格に、
 * 周辺フィールド（mechanism / extractedPattern 等）は寛容に検証する。
 * 弱いモデルが周辺を落としても、核が立っていれば解読として成立させる。
 */
export function isDecodeOutput(value: unknown): value is DecodeOutput {
  if (!isRecord(value)) return false;

  // 核: 一言でいうと・なぜすごいのか（根拠句つき・1件以上）・before/after
  if (typeof value.oneLiner !== "string" || value.oneLiner.trim().length === 0) return false;
  if (
    !Array.isArray(value.whySignificant) ||
    value.whySignificant.length === 0 ||
    !value.whySignificant.every(
      (w) => isRecord(w) && typeof w.point === "string" && typeof w.evidence === "string"
    )
  ) {
    return false;
  }
  const ba = value.beforeAfter;
  if (
    !isRecord(ba) ||
    typeof ba.before !== "string" ||
    typeof ba.trigger !== "string" ||
    typeof ba.after !== "string"
  ) {
    return false;
  }

  // 周辺: 形が合わないときだけ弾く（欠落は provider 側でデフォルト補完）
  if (value.evidenceQuotes !== undefined && !isStringArray(value.evidenceQuotes)) return false;
  if (value.synthesisTags !== undefined && !isStringArray(value.synthesisTags)) return false;
  if (value.mechanism !== undefined && value.mechanism !== null) {
    const m = value.mechanism;
    if (
      !isRecord(m) ||
      !Array.isArray(m.items) ||
      !m.items.every(
        (it) => isRecord(it) && typeof it.element === "string" && typeof it.role === "string"
      )
    ) {
      return false;
    }
  }
  if (value.extractedPattern !== undefined && value.extractedPattern !== null) {
    const p = value.extractedPattern;
    if (
      !isRecord(p) ||
      typeof p.name !== "string" ||
      typeof p.structure !== "string" ||
      !isStringArray(p.variableSlots) ||
      typeof p.transferScope !== "string"
    ) {
      return false;
    }
  }
  if (value.outputSeed !== undefined && value.outputSeed !== null) {
    const s = value.outputSeed;
    if (!isRecord(s) || typeof s.angle !== "string") return false;
  }
  if (value.adjacentPatterns !== undefined && value.adjacentPatterns !== null) {
    if (
      !Array.isArray(value.adjacentPatterns) ||
      !value.adjacentPatterns.every(
        (a) => isRecord(a) && typeof a.name === "string" && typeof a.description === "string"
      )
    ) {
      return false;
    }
  }
  return true;
}

export function validateSynthesisOutput(raw: unknown): SynthesisOutput {
  if (!isRecord(raw)) {
    throw new Error("掛け合わせ生成の形式が不正です");
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const angle = typeof raw.angle === "string" ? raw.angle.trim() : "";
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  const takeaway = typeof raw.takeaway === "string" ? raw.takeaway.trim() : "";

  if (!title || !angle || !reason || !takeaway) {
    throw new Error("掛け合わせ生成の必須フィールドが空です");
  }
  if (title.length > 60) {
    throw new Error("掛け合わせ生成のtitleが60文字を超えています");
  }

  const bannedWords = ["相乗効果", "シナジー", "革命", "震撼", "覇権"];
  const body = `${angle}\n${reason}\n${takeaway}`;
  const banned = bannedWords.find((word) => body.includes(word));
  if (banned) {
    throw new Error(`掛け合わせ生成に禁止語が含まれています: ${banned}`);
  }

  return {
    title,
    angle,
    reason,
    takeaway,
    seedHook: typeof raw.seedHook === "string" ? raw.seedHook.trim() || null : null,
  };
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

/** セミナー①設計の検証。schedule と seminar.name が立っていれば成立（他は寛容）。 */
export function isSeminarDesign(value: unknown): value is SeminarDesign {
  if (!isRecord(value)) return false;
  if (!isRecord(value.seminar) || typeof value.seminar.name !== "string") return false;
  return (
    Array.isArray(value.schedule) &&
    value.schedule.length > 0 &&
    value.schedule.every((s) => isRecord(s))
  );
}

/** セミナー②中身の検証。slides と chapterDetails が配列で存在すれば成立（枚数は機械チェック側で見る）。 */
export function isSeminarContent(value: unknown): value is SeminarContent {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.slides) &&
    value.slides.every((s) => isRecord(s)) &&
    Array.isArray(value.chapterDetails) &&
    value.chapterDetails.every((c) => isRecord(c))
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
