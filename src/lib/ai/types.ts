// AI Provider Types

export interface ClassifyPostInput {
  text: string;
  authorName?: string | null;
  authorUsername?: string | null;
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
  recommendedMode: "thought_lens" | "learning_lesson" | "unknown";
}

export interface GenerateDeepDiveSessionInput {
  mode: "thought_lens" | "learning_lesson";
  postText: string;
  classification: PostClassificationResult;
}

export interface DeepDiveStepContent {
  stepIndex: number;
  stepKey: string;
  title: string;
  question: string;
  aiContent: {
    explanation: string;
    keyPoints?: string[];
    examples?: string[];
    promptForUser?: string;
  };
}

export interface GeneratedDeepDiveSessionResult {
  steps: DeepDiveStepContent[];
  recommendedModeReason?: string;
}

export interface GenerateOutputInput {
  outputType: "x" | "instagram" | "note" | "markdown_log";
  postText: string;
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

export interface AiProvider {
  classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult>;
  generateDeepDiveSession(input: GenerateDeepDiveSessionInput): Promise<GeneratedDeepDiveSessionResult>;
  generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult>;
}

export interface ConfirmationInsight {
  summary: string;
  gains: {
    basicUnderstanding: string;
    practicalPattern: string;
    outputApplication: string;
    thoughtOrganization: string;
  };
}

export interface ModeRecommendation {
  recommendedMode: "thought_lens" | "learning_lesson";
  reason: string;
}
