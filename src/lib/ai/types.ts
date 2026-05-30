// AI Provider Types

export interface ClassifyPostInput {
  text: string;
  authorName?: string | null;
  authorUsername?: string | null;
  /** Optional article body (e.g. user-pasted X Article text or fetched URL content) */
  articleContent?: string;
}

export interface TranslateTextInput {
  text: string;
}

export interface SourcePostForLearning {
  id: string;
  authorName: string;
  authorHandle: string;
  text: string;
  translatedText?: string;
  postUrl: string;
  postedAt?: string;
  media: {
    type: "image" | "video" | "gif";
    url: string;
    thumbnailUrl?: string;
    altText?: string;
  }[];
  tags?: string[];
  genre?: string;
  type?: string;
  existingSummary?: string;
  userMemo?: string;
  /** Article content when the post is a link to an external article */
  articleTitle?: string;
  articleDescription?: string;
  /** User-pasted video transcript */
  videoTranscript?: string;
  /** Learning mode: "content" extracts the topic itself, "format" extracts reusable patterns */
  learningMode?: "content" | "format";
}

/**
 * ① 投稿の中身そのものを忠実に転写したもの。
 * 抽象化・批評はせず、「この通りやれば同じ結果」になる粒度で中身だけを残す。
 * format に応じて items / verbatim を使い分ける。
 */
export interface LearningCapture {
  /** list=要素列挙 / steps=手順 / claims=主張 / template=プロンプト等の原文 / narrative=地の文 */
  format: "list" | "steps" | "claims" | "template" | "narrative";
  /** 中身を一言で表す見出し（例: コンバートするヒーローの10要素） */
  headline: string;
  items: { label: string; body: string; detail?: string }[];
  /** format=template のときのみ：テンプレ/プロンプトの原文 */
  verbatim?: string | null;
  /** format=template のときのみ：使うときの手順 */
  usage?: string | null;
}

/**
 * ③ 初心者ゾーン：独立セクション。
 * 「初心者はここで詰まる」先回りと、やさしい用語解説。
 */
export interface BeginnerZone {
  stumblingPoints: { point: string; explanation: string }[];
  glossary: { term: string; explanation: string }[];
}

export interface LearningOutput {
  sourcePostId: string;
  title: string;
  /** 一言でいうと（オリエンテーション・短く） */
  summary: string;
  /** 投稿者が本当に伝えたかったこと */
  originalIntent: string;
  /** なぜあなたが見る価値があるか */
  whyForYou?: string;
  /** ① 投稿の中身そのもの（忠実転写） */
  capture?: LearningCapture;
  steps: {
    title: string;
    description: string;
    actions: string[];
  }[];
  applicationIdeas: {
    title: string;
    description: string;
  }[];
  tips: string[];
  useCases: string[];
  /** ③ 初心者ゾーン */
  beginnerZone?: BeginnerZone;
  diagramStructure: {
    title: string;
    sections: {
      heading: string;
      body: string;
      visualIdea?: string;
    }[];
  };
  imageExplanationPrompt: string;
  userLearningMemo: string;
  backgroundContext?: BackgroundContext | null;
  status: "draft" | "saved";

  // --- legacy（旧カード互換。新規生成では使わない） ---
  whatIsInteresting?: string;
  coreInsight?: string;
  structure?: {
    label: string;
    description: string;
  }[];
  manual?: string;
}

/**
 * 投稿を理解するための「周辺情報」。
 * 勉強のできる解説者が補足する形：原典・時代背景・類似フレームワーク等。
 * 投稿タイプによって該当しない項目は null/空配列で返す。
 */
export interface BackgroundContext {
  postType?: string | null;
  origin?: string | null;
  historicalContext?: string | null;
  relatedFrameworks?: { name: string; description: string; relation: string }[];
  referencedWorks?: { name: string; context: string }[];
  furtherReading?: { topic: string; reason: string }[];
  terminology?: { term: string; explanation: string }[];
}

export interface PostClassificationResult {
  postType: "thought" | "learning" | "output_material" | "unknown";
  primaryCategory: string;
  tags: string[];
  summary: string;
  recommendReason: string;
  difficultyLevel: "beginner" | "intermediate" | "advanced" | "unknown";
  thinkingPotentialScore: number;
  learningPotentialScore: number;
  outputPotentialScore: number;
  /** Kept for storage compatibility; not used to drive UI flows. */
  recommendedMode: string;
}

export type OutputType =
  | "x"
  | "instagram"
  | "short_video"
  | "note"
  | "markdown_log"
  | "seminar"
  | "strict_learning";

export interface GenerateOutputInput {
  outputType: OutputType;
  postText: string;
  postAuthorName?: string | null;
  postAuthorUsername?: string | null;
  classification: PostClassificationResult;
  steps: {
    title: string;
    question: string;
    aiContent: string;
    userNote?: string | null;
  }[];
  userFinalNote?: string | null;
  finalSummary?: string | null;
}

export interface GeneratedOutputResult {
  title: string;
  content: string;
  contentJson?: Record<string, unknown>;
}

export interface StrictLearningOutput {
  oneLiner: string;
  whyItMatters: string;
  prerequisites: string;
  claimBreakdown: {
    claim: string;
    background: string;
    assumption: string;
    evidence: string;
    counterExample: string;
    limit: string;
  };
  strictLearningView: {
    positiveExamples: string[];
    negativeExamples: string[];
    boundaryExamples: string[];
    necessaryConditions: string[];
    typicalFeatures: string[];
    essence: string;
  };
  abstraction: string;
  transferToOtherFields: {
    field: string;
    application: string;
  }[];
  applyToYourself: string;
  fifteenMinuteExercise: {
    goal: string;
    steps: string[];
    deliverable: string;
  };
}

export interface PostSummaryForSearch {
  id: string;
  summary: string;
  tags: string[];
  primaryCategory: string;
  postType: string;
}

export interface SemanticSearchResultItem {
  postId: string;
  relevanceScore: number;
  reason: string;
}

export interface SemanticSearchResult {
  results: SemanticSearchResultItem[];
}

export interface PostSummaryForTrend {
  summary: string;
  primaryCategory: string;
  postType: string;
  tags: string[];
  difficultyLevel: string;
}

export interface TrendInsight {
  topCategories: string[];
  favoriteThemes: string[];
  learningStyle: string;
  strengths: string[];
  recommendedNextTopics: string[];
  summary: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PostContext {
  id: string;
  text: string;
  summary?: string;
  primaryCategory?: string;
  tags?: string[];
  sourceUrl?: string | null;
  authorUsername?: string | null;
}

export interface AiProvider {
  classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult>;
  translateText(input: TranslateTextInput): Promise<string>;
  generateLearningCard(input: SourcePostForLearning): Promise<LearningOutput>;
  generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult>;
  generateStrictLearning(input: {
    postText: string;
    classification: { primaryCategory: string; summary: string };
    articleTitle?: string;
    articleDescription?: string;
    learningCardJson?: string;
    userMemo?: string | null;
  }): Promise<StrictLearningOutput>;
  searchSemantically(query: string, posts: PostSummaryForSearch[]): Promise<SemanticSearchResult>;
  analyzeLikeTrends(posts: PostSummaryForTrend[]): Promise<TrendInsight>;
  chat(message: string, history: ChatMessage[], posts: PostContext[]): Promise<string>;
}
