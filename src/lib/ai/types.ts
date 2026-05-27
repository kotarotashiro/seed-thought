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

export interface LearningOutput {
  sourcePostId: string;
  title: string;
  summary: string;
  originalIntent: string;
  whatIsInteresting: string;
  coreInsight: string;
  structure: {
    label: string;
    description: string;
  }[];
  steps: {
    title: string;
    description: string;
    actions: string[];
  }[];
  manual: string;
  applicationIdeas: {
    title: string;
    description: string;
  }[];
  tips: string[];
  useCases: string[];
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
  status: "draft" | "saved";
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
