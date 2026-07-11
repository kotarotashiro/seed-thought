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
    /** ビジョンモデルが読み取った画像の中身（テキスト/図/スクショの説明） */
    description?: string;
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

/**
 * 解読器（SeedThought 2）の出力。
 * 「なぜすごいのか」「何が変わったか(before/after)」を投稿から解読し、
 * 発信の背景文脈と再利用可能な型を取り出す。
 * 全主張は evidenceQuotes（投稿からの抜き出し句）に根拠を紐付ける（引用ファースト）。
 * 品質基準: docs/seedthought2-decoder-gold-sample.md
 */
export interface DecodeOutput {
  /** 引用ファースト: 解読の根拠となる投稿からの抜き出し句（3〜8個） */
  evidenceQuotes: string[];
  /** この投稿の正体を一言で（要約ではなく「何を実現したものか」） */
  oneLiner: string;
  /** なぜすごいのか。各ポイントに根拠句を紐付ける */
  whySignificant: { point: string; evidence: string }[];
  /** 変化の文脈。発信時に初級者へ伝わる導入の核材料になる */
  beforeAfter: {
    /** 今まで: どうするしかなかったか */
    before: string;
    /** これが出た: 何が登場・変化したか */
    trigger: string;
    /** こう変わる: 誰に何ができるようになるか */
    after: string;
  };
  /** 仕組みの解読（旧・学習カードの理解パートの統合先）。要素→実務上の役割 */
  mechanism: {
    items: { element: string; role: string }[];
    /** 原典・系譜（どこから来た手法/考え方か）。不明なら null */
    lineage: string | null;
  } | null;
  /** 再利用可能な型。型が抽出できない投稿（感想・ニュース等）は null */
  extractedPattern: {
    name: string;
    structure: string;
    variableSlots: string[];
    /** どこまで転用できるか（元の領域の外を必ず考える） */
    transferScope: string;
    usageNote: string | null;
  } | null;
  /**
   * 同ジャンルの隣接する定番の型（派生の地図）。
   * 唯一、投稿の外の一般知識を使ってよいフィールド。実在する定番のみ・でっちあげ禁止。
   * 各型にすぐ試せるプロンプト案を付け、この投稿から横に派生できるようにする。
   */
  adjacentPatterns?: {
    name: string;
    description: string;
    /**
     * その型をそのまま試せる実行形。形式はジャンルに合わせる
     * （プロンプト/穴埋めテンプレ/問いリスト/最小手順）。実行形にできない型は null
     */
    actionable: string | null;
  }[] | null;
  /** 掛け合わせエンジン用のフック（短いタグ3〜6個） */
  synthesisTags: string[];
  /** 発信ネタの種（2パス生成への入力） */
  outputSeed: {
    /** 切り口。before/after を導入に使う形で */
    angle: string;
    /** 冒頭フック案。無ければ null */
    hook: string | null;
  };
}

export interface SynthesisMaterial {
  kind: "card" | "pattern";
  title: string;
  oneLiner: string;
  beforeAfter: string;
  patternSummary: string | null;
  tags: string[];
  outputSeedAngle: string | null;
}

export interface SynthesisInput {
  materialA: SynthesisMaterial;
  materialB: SynthesisMaterial;
}

/** 掛け合わせエンジン（SeedThought 2 ステップ4最小版）の LLM 出力 */
export interface SynthesisOutput {
  /** 提案のタイトル。60字以内 */
  title: string;
  /** 切り口。何を軸に掛け合わせるか（1〜3文） */
  angle: string;
  /** なぜこの2つを掛けるのか。共通構造 or 緊張関係を明示（1〜3文） */
  reason: string;
  /** 読者の持ち帰り。1文 */
  takeaway: string;
  /** 発信の冒頭フック案。なければ null */
  seedHook: string | null;
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
    /**
     * そのまま使える実行形。形式は投稿のジャンルに合わせる：
     * プロンプト系→貼れるプロンプト / 文章術→穴埋めテンプレ / 思考法→自分に当てる問いリスト /
     * 手順系→最小手順。実行形にできない投稿（思想・ニュース等）は null（無理に作らない）
     */
    actionable?: string | null;
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
  /** 解読器の出力（SeedThought 2）。生成失敗時や旧カードは null/undefined */
  decode?: DecodeOutput | null;
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

export interface NoteSection {
  heading: string;
  body: string;
}

/**
 * セミナー2分割生成の「①設計」出力。
 * 巨大スキーマの1ショット生成はモデルが省略する（スライド2枚・章詳細1件等）ため、
 * 設計と中身に分割する。フィールドの詳細構造はプロンプト側が規定し、ここでは
 * 機械チェックに必要な部分だけ型を持つ。
 */
export interface SeminarDesign {
  coreInterpretation?: Record<string, unknown>;
  titleOptions?: unknown[];
  seminar: { name: string; [key: string]: unknown };
  schedule: { time?: string; part?: string; content?: string; purpose?: string }[];
  promotion?: Record<string, unknown>;
  salesFunnel?: Record<string, unknown>;
  finalStatement?: string;
}

/** セミナー2分割生成の「②中身」出力。 */
export interface SeminarContent {
  chapterDetails: { part?: string; script?: string; [key: string]: unknown }[];
  demonstration?: Record<string, unknown>;
  workshop?: Record<string, unknown>;
  templates?: Record<string, unknown>;
  slides: { slideNumber?: number; title?: string; content?: string; visualIdea?: string }[];
}

export interface NoteContentJson {
  source?: string;
  sections: NoteSection[];
}

export interface GenerateOutputInput {
  outputType: OutputType;
  /**
   * さとり構文の型指定（X媒体のみ有効）。
   * "auto" または未指定のときは投稿内容からAIが最適な型を選ぶ。
   * "A" | "B" | "C" | "D" | "E" で型を固定できる。
   */
  satoriType?: "auto" | "A" | "B" | "C" | "D" | "E";
  /**
   * 引用元アカウントの明記可否。
   * 未指定/true のときは従来どおり @ユーザー名・氏名を出典として本文に明示する。
   * false のときはアカウント名・@ユーザー名・氏名を本文に一切出さず、匿名の引用として生成する。
   */
  citeAuthor?: boolean;
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
  /** X媒体のさとり構文で実際に使われた型（A〜E）。auto選択時にAIが返す。非X媒体はundefined。 */
  satoriTypeUsed?: string;
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
  /** 学習カードが生成済みの場合に含まれるフィールド */
  cardId?: string | null;
  cardTitle?: string | null;
  coreInsight?: string | null;
}

// 工程ごとの設定（settings）を上書きして、その場限りで使うモデルを指定する。
// provider 未指定なら設定どおりのモデルが使われる。
export interface AiModelOverride {
  provider?: string | null;
  model?: string | null;
}

export interface AiProvider {
  classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult>;
  translateText(input: TranslateTextInput): Promise<string>;
  generateLearningCard(
    input: SourcePostForLearning,
    override?: AiModelOverride | null
  ): Promise<LearningOutput>;
  generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult>;
  generateSynthesis(input: SynthesisInput): Promise<SynthesisOutput>;
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
