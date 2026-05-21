import type {
  GeneratedOutputResult,
  OutputType,
  PostClassificationResult,
  StrictLearningOutput,
} from "./types";

const learningWords = [
  "方法",
  "手順",
  "設定",
  "使い方",
  "作り方",
  "解説",
  "ツール",
  "機能",
  "API",
  "コード",
];

const outputWords = [
  "発信",
  "投稿",
  "SNS",
  "Instagram",
  "X",
  "note",
  "LP",
  "チラシ",
  "スライド",
  "資料",
];

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function trimJapanese(text: string, maxLength: number): string {
  const compact = compactText(text);
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function inferPostType(text: string): PostClassificationResult["postType"] {
  const lower = text.toLowerCase();
  if (learningWords.some((word) => lower.includes(word.toLowerCase()))) return "learning";
  if (outputWords.some((word) => lower.includes(word.toLowerCase()))) return "output_material";
  return "thought";
}

function inferCategory(text: string): string {
  if (/AI|Claude|ChatGPT|Codex|Gemini|v0|Cursor/i.test(text)) return "AI活用";
  if (/LINE|Instagram|SNS|X|note|投稿|発信/i.test(text)) return "SNS運用";
  if (/マーケ|集客|広告|LP|セミナー/i.test(text)) return "マーケティング";
  if (/デザイン|Canva|Photoshop|画像|動画/i.test(text)) return "クリエイティブ";
  return "思考整理";
}

function buildSummary(text: string): string {
  const compact = compactText(text);
  if (compact.includes("ツルハシ")) {
    return "市場では、道具を売る側、使う側、その支援側の順に利益機会が生まれるという構造を説明している投稿です。";
  }
  if (/Codex|Claude Code|ChatGPT|Gemini|Cursor/i.test(compact)) {
    return "AI開発ツールやエージェント活用の新機能・使い方を紹介し、実務でどう活かせるかのヒントを示している投稿です。";
  }
  if (/LINE|Instagram|SNS|X|note|投稿|発信/i.test(compact)) {
    return "SNSや導線設計の成果につながる考え方や実践ポイントを、自分の発信に応用できる形で示している投稿です。";
  }
  if (/Canva|Photoshop|画像|動画|スライド|資料/i.test(compact)) {
    return "制作物の見せ方や作業効率を高めるための具体的な工夫を、クリエイティブ実務向けに紹介している投稿です。";
  }
  const firstSentence = compact.split(/[。！？!?]/)[0] || compact;
  if (firstSentence.length <= 70) {
    return `${firstSentence}、という視点を提示している投稿です。`;
  }
  return `${trimJapanese(firstSentence, 72)}について、要点や考え方を共有している投稿です。`;
}

function inferLearningTopic(text: string): {
  topic: string;
  basics: string;
  mechanism: string;
  practicalSteps: string[];
  examples: string[];
} {
  const compact = compactText(text);

  if (/\/goal|goal|Claude Code/i.test(compact)) {
    return {
      topic: "Claude Codeの /goal によるゴール駆動の開発進行",
      basics:
        "/goal は、作業の完了条件を先に言語化して、AIに進捗判断をさせながら作業を進める考え方です。単に「続けて」と頼むのではなく、何が終わったら完了かを明確にすることで、AIの自走を安定させます。",
      mechanism:
        "AIは毎回、現在の作業がゴールに近づいているか、まだ足りない点は何かを判定します。これにより、実装、検証、修正のループが目的から外れにくくなります。",
      practicalSteps: [
        "最初に「完成条件」を1行で書く",
        "作業途中でAIに達成状況を判定させる",
        "未達の理由をもとに次のタスクへ進ませる",
      ],
      examples: [
        "例: 「保存一覧で投稿日順ソートができ、ビルドが通る状態まで完了」",
        "例: 「X同期でいいねのみを取得し、重複時はスキップ数が表示される状態まで完了」",
      ],
    };
  }

  if (/Codex|ChatGPT|Gemini|Cursor|v0/i.test(compact)) {
    return {
      topic: "AI開発ツールを実務に取り入れる方法",
      basics:
        "AI開発ツールは、コードを書く道具というより、設計、実装、検証、修正を一緒に進める作業パートナーです。重要なのは、依頼内容を小さく分け、完成条件を明確にすることです。",
      mechanism:
        "AIは文脈と指示から次の作業を推定します。完成条件、制約、確認方法が具体的なほど、出力のブレが減り、実務で使える成果物になりやすくなります。",
      practicalSteps: [
        "やりたいことを1つの画面・1つの機能に絞る",
        "完成条件と確認方法を先に書く",
        "生成後に必ず実画面とテストで確認する",
      ],
      examples: [
        "保存一覧をカードUIにする場合、表示項目、ボタン、ソート条件を先に決める",
        "AI要約を直す場合、良い要約と悪い要約の例を与える",
      ],
    };
  }

  if (/ツルハシ/.test(compact)) {
    return {
      topic: "市場で利益が生まれる順番を見る考え方",
      basics:
        "この投稿の中心は、流行そのものよりも、その流行を支える道具・支援・応用の市場を見るという視点です。誰が最初に利益を得るか、次に誰が成果を出すかを分けて考えます。",
      mechanism:
        "新しい市場では、まず道具を売る側が利益を得やすく、その後、道具を使って成果を出す側、さらにその人たちを支援する側へ機会が広がります。ただし、使う側が成果を出せない市場は長続きしません。",
      practicalSteps: [
        "市場の参加者を「売る側」「使う側」「支援する側」に分ける",
        "自分がどの立場で価値を出せるか考える",
        "読者にとって再現できる形に言い換える",
      ],
      examples: [
        "AI市場なら、ツール提供者、AIを使う事業者、導入支援者に分けて見る",
        "SNS運用なら、教材販売者、実践者、添削や運用支援者に分けて見る",
      ],
    };
  }

  return {
    topic: buildSummary(text),
    basics:
      "この投稿を学習素材にするには、まず主張、背景、使える場面を分けて読むことが大切です。投稿文の表現ではなく、そこにある考え方を取り出します。",
    mechanism:
      "投稿の中には、原因、方法、結果の関係があります。その関係を見つけると、別のテーマや自分の仕事にも応用しやすくなります。",
    practicalSteps: [
      "投稿の結論を一文で抜き出す",
      "なぜそう言えるのかを整理する",
      "自分の発信や仕事に置き換える",
    ],
    examples: [
      "投稿の考え方を、自分の読者が抱える悩みに変換する",
      "具体的な行動手順やチェックリストに変える",
    ],
  };
}

function buildRecommendReason(type: PostClassificationResult["postType"], category: string): string {
  if (type === "learning") {
    return `${category}の具体的な手順や考え方を、自分の実務に置き換えて整理できます。`;
  }
  if (type === "output_material") {
    return `${category}の発信ネタとして、構成や切り口を自分の言葉に変換できます。`;
  }
  return `${category}に関する前提や構造を分解し、自分の判断軸として深掘りできます。`;
}

export function createFallbackClassification(input: {
  text: string;
}): PostClassificationResult {
  const postType = inferPostType(input.text);
  const primaryCategory = inferCategory(input.text);

  return {
    postType,
    primaryCategory,
    tags: [primaryCategory, postType === "learning" ? "ノウハウ" : "視点", "学習候補"],
    summary: buildSummary(input.text),
    recommendReason: buildRecommendReason(postType, primaryCategory),
    difficultyLevel: postType === "learning" ? "intermediate" : "beginner",
    thinkingPotentialScore: postType === "thought" ? 85 : 65,
    learningPotentialScore: postType === "learning" ? 85 : 60,
    outputPotentialScore: postType === "output_material" ? 85 : 70,
    recommendedMode: "unknown",
  };
}

export function isWeakClassification(classification: {
  postType: string;
  primaryCategory: string;
  summary: string;
  recommendReason: string;
}): boolean {
  const summary = compactText(classification.summary);
  return (
    classification.postType === "unknown" ||
    classification.primaryCategory === "未分類" ||
    summary.length < 18 ||
    summary.includes("新しく保存された投稿") ||
    classification.recommendReason.includes("新しく保存された投稿")
  );
}

export function mergeClassificationFallback(
  text: string,
  classification: PostClassificationResult
): PostClassificationResult {
  if (!isWeakClassification(classification)) return classification;
  const fallback = createFallbackClassification({ text });
  return {
    ...fallback,
    ...classification,
    postType: classification.postType === "unknown" ? fallback.postType : classification.postType,
    primaryCategory:
      classification.primaryCategory === "未分類"
        ? fallback.primaryCategory
        : classification.primaryCategory,
    summary:
      classification.summary.includes("新しく保存された投稿") || classification.summary.length < 18
        ? fallback.summary
        : classification.summary,
    recommendReason:
      classification.recommendReason.includes("新しく保存された投稿") ||
      classification.recommendReason.length < 18
        ? fallback.recommendReason
        : classification.recommendReason,
  };
}

export function createFallbackStrictLearning(input: {
  postText: string;
  classification: PostClassificationResult;
}): StrictLearningOutput {
  const summary = input.classification.summary || buildSummary(input.postText);
  const lesson = inferLearningTopic(input.postText);
  const category = input.classification.primaryCategory || "学び";

  return {
    oneLiner: lesson.topic,
    whyItMatters: `${summary} この投稿は${category}領域で、保存して終わりにせず構造化することで応用が利く学びです。`,
    prerequisites: lesson.basics,
    claimBreakdown: {
      claim: summary,
      background: lesson.basics,
      assumption: "受け取る側が前提知識を持ち、自分の文脈に置き換える意思があること。",
      evidence: lesson.mechanism,
      counterExample: "状況が大きく違う領域では、そのまま当てはめると外れることがある。",
      limit: `主に${category}領域で有効。文脈が変わると必要条件が変わる。`,
    },
    strictLearningView: {
      positiveExamples: lesson.examples.slice(0, 3),
      negativeExamples: ["表面だけ真似て前提を省くと再現しない例", "領域違いに無理に当てはめた例"],
      boundaryExamples: ["前提が一部しか揃っていない中規模の例", "目的は同じだが手段が異なる例"],
      necessaryConditions: lesson.practicalSteps.slice(0, 3),
      typicalFeatures: ["短く言い切る形をとっている", "具体的な手順や視点を含んでいる"],
      essence: lesson.mechanism,
    },
    abstraction: `${category}固有の話に見えるが、根は「目的を明確にしてから手段を選ぶ」「成立条件と典型特徴を分ける」という普遍的構造に還元できる。`,
    transferToOtherFields: [
      { field: "別のSNS発信", application: "投稿の型を別チャネル向けに置き換えて、必要条件を再確認する。" },
      { field: "顧客対応／コンサル", application: "同じ構造を顧客の課題に当てはめ、本質と典型特徴を分けて説明する。" },
    ],
    applyToYourself: "自分のテーマで一つ題材を選び、必要条件・典型特徴・本質に分けてから、15分で短いアウトプットに変換する。",
    fifteenMinuteExercise: {
      goal: "投稿の構造を自分のテーマに移植した短文を一つ完成させる。",
      steps: [
        "投稿の一言要約を自分の言葉で書く",
        "必要条件と典型特徴を分けて列挙する",
        "自分のテーマに置き換えた具体例を一つ作る",
        "X投稿または学習メモとして出力する",
      ],
      deliverable: "自分のテーマに合わせた短い学習メモ（X投稿1本分または100-200文字のメモ）",
    },
  };
}

export function createFallbackOutput(input: {
  outputType: OutputType;
  postText: string;
  classification: PostClassificationResult;
  finalSummary?: string | null;
  userFinalNote?: string | null;
}): GeneratedOutputResult {
  const summary = input.finalSummary || input.classification.summary || buildSummary(input.postText);
  const note = input.userFinalNote ? `\n\n自分のメモ: ${input.userFinalNote}` : "";

  if (input.outputType === "x") {
    return {
      title: "X投稿下書き",
      content: `${summary}\n\n保存した投稿から学べるのは、情報そのものより「どう自分の仕事に置き換えるか」。一度、自分のテーマで使える形に言い換えてみる。\n\n#${input.classification.primaryCategory} #学び`,
    };
  }

  if (input.outputType === "instagram") {
    return {
      title: "Instagramカルーセル下書き",
      content: "カルーセル構成の下書きです。",
      contentJson: {
        slides: [
          { slideNumber: 1, heading: "保存した投稿から学ぶ", body: summary, note: "導入" },
          { slideNumber: 2, heading: "ポイント", body: input.classification.recommendReason, note: "学びの核" },
          { slideNumber: 3, heading: "自分に置き換える", body: input.userFinalNote || "自分の仕事や発信テーマに当てはめる", note: "実践" },
        ],
      },
    };
  }

  if (input.outputType === "note") {
    return {
      title: "保存した投稿からの学び",
      content: `# 保存した投稿からの学び\n\n${summary}\n\n## なぜ気になったか\n${input.classification.recommendReason}\n\n## 自分の仕事に置き換えるなら\n${input.userFinalNote || "この視点を自分の発信テーマや導線設計に置き換えて考える。"}${note}`,
    };
  }

  if (input.outputType === "strict_learning") {
    const fallback = createFallbackStrictLearning({
      postText: input.postText,
      classification: input.classification,
    });
    return {
      title: `厳密学習: ${fallback.oneLiner}`,
      content: `${fallback.oneLiner}\n\n${fallback.whyItMatters}`,
      contentJson: fallback as unknown as Record<string, unknown>,
    };
  }

  return {
    title: "Markdown学習ログ",
    content: `# 学習ログ\n\n## 投稿の要点\n${summary}\n\n## 学びのポイント\n- ${input.classification.recommendReason}\n- 自分のテーマに置き換える\n- 次の発信や実務に使える形にする\n\n## 自分のメモ\n${input.userFinalNote || "未記入"}`,
  };
}
