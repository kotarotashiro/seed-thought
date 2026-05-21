import type {
  DeepDiveStepContent,
  GeneratedDeepDiveSessionResult,
  GeneratedOutputResult,
  PostClassificationResult,
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
  const recommendedMode = postType === "learning" ? "learning_lesson" : "thought_lens";

  return {
    postType,
    primaryCategory,
    tags: [primaryCategory, postType === "learning" ? "ノウハウ" : "視点", "深掘り候補"],
    summary: buildSummary(input.text),
    recommendReason: buildRecommendReason(postType, primaryCategory),
    difficultyLevel: postType === "learning" ? "intermediate" : "beginner",
    thinkingPotentialScore: postType === "thought" ? 85 : 65,
    learningPotentialScore: postType === "learning" ? 85 : 60,
    outputPotentialScore: postType === "output_material" ? 85 : 70,
    recommendedMode,
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
    recommendedMode:
      classification.recommendedMode === "unknown"
        ? fallback.recommendedMode
        : classification.recommendedMode,
  };
}

function step(
  stepIndex: number,
  stepKey: string,
  title: string,
  question: string,
  explanation: string,
  keyPoints: string[],
  examples: string[],
  promptForUser: string
): DeepDiveStepContent {
  return {
    stepIndex,
    stepKey,
    title,
    question,
    aiContent: {
      explanation,
      keyPoints,
      examples,
      promptForUser,
    },
  };
}

export function createFallbackDeepDiveSession(input: {
  mode: "thought_lens" | "learning_lesson";
  postText: string;
  classification: PostClassificationResult;
}): GeneratedDeepDiveSessionResult {
  const summary = input.classification.summary || buildSummary(input.postText);
  const category = input.classification.primaryCategory;
  const lesson = inferLearningTopic(input.postText);

  const steps =
    input.mode === "thought_lens"
      ? [
          step(
            0,
            "surface_claim",
            "表面的な主張",
            "この投稿は、何を一番伝えようとしていると思いますか？",
            `まずは投稿の主張を短く抜き出します。今回の中心は「${summary}」です。言葉の強さや例えに引っ張られず、何を正しいと言っているのかを一文にします。`,
            ["主張を一文にする", "例えと結論を分ける", "断定している部分を見る"],
            ["この投稿は、市場で利益が生まれる順番について述べている", "この投稿は、発信や事業の勝ち筋を説明している"],
            "まずは結論だけを一文で書いてください。"
          ),
          step(
            1,
            "hidden_premise",
            "背後にある前提",
            "この主張が成り立つには、どんな前提が必要ですか？",
            `投稿の裏には、${category}に関する前提があります。誰が先に得をするのか、どの条件なら再現できるのかを分けると、投稿の使える範囲が見えてきます。`,
            ["成立条件を見る", "対象者を限定する", "例外を探す"],
            ["市場が拡大している場合に成り立つ", "買う側が成果を出せる設計が必要になる"],
            "この考えが外れるケースを書いてください。"
          ),
          step(
            2,
            "essence",
            "この投稿の本質",
            "この投稿の本質を、もっと抽象化すると何になりますか？",
            "本質は、具体例の奥にある構造です。誰かのノウハウをそのまま真似るのではなく、利益、信頼、需要、継続性の関係として捉えると応用しやすくなります。",
            ["具体から構造へ移す", "因果関係を見る", "自分のテーマに使える形にする"],
            ["道具を売る側と使う側の関係", "市場の入口と出口の違い"],
            "この投稿を一段抽象化して書いてください。"
          ),
          step(
            3,
            "counter_argument",
            "反論・成立条件",
            "反論するとしたら、どこに違和感がありますか？",
            "深掘りでは、納得した点だけでなく反論も大事です。反論を置くことで、盲信ではなく自分の判断として扱えるようになります。",
            ["反例を探す", "短期と長期を分ける", "自分の実感と照らす"],
            ["売る側だけが儲かる市場は長続きしない", "買う側の成果がないと信用が落ちる"],
            "納得できる点と疑問点を分けて書いてください。"
          ),
          step(
            4,
            "apply_to_work",
            "自分の仕事に置き換える",
            "この視点を、自分の発信や仕事に置き換えると何が言えますか？",
            "自分のテーマに置き換えると、保存しただけの情報が使える知識になります。あなたの発信、商品、導線、企画に当てはめて考えます。",
            ["自分のテーマへ翻訳する", "顧客の立場で考える", "次の投稿ネタにする"],
            ["AI活用の発信なら、ツール紹介だけでなく成果設計まで話す", "LINE導線なら、設定方法より売上までの流れを示す"],
            "自分の仕事ならどう言い換えられるか書いてください。"
          ),
          step(
            5,
            "own_words",
            "自分の言葉でまとめる",
            "最後に、自分の言葉で一段落にまとめるとどうなりますか？",
            "ここでは投稿の引用ではなく、あなたの理解としてまとめます。あとでX投稿、note、学習ログに変換しやすい形にしておきます。",
            ["引用ではなく自分の言葉にする", "一文目に結論を書く", "実務への示唆で締める"],
            ["市場を見るときは、誰が先に儲かるかだけでなく、その後誰が成果を出すかまで見る必要がある"],
            "自分の結論を一段落で書いてください。"
          ),
        ]
      : [
          step(
            0,
            "what_to_learn",
            "この投稿から学べること",
            `まず、この投稿は何を教えてくれていると思いますか？`,
            `この投稿は「${lesson.topic}」を学ぶための教材です。最初に難しく考えなくて大丈夫です。まずは「この投稿は、何をできるようにする話なのか」をつかみます。そのうえで、正例、つまり当てはまる例と、反例、つまり一見似ているけれど違う例を比べながら、投稿の本質を絞っていきます。`,
            ["一言でいうと何の話かを見る", "当てはまる例と違う例を比べる", "自分が使える場面まで落とす"],
            lesson.examples,
            "一言でいうと何の話かを書いてみてください。"
          ),
          step(
            1,
            "basics",
            "基礎知識",
            "理解するために必要な基礎知識は何ですか？",
            `${lesson.basics}\n\nここで大事なのは、言葉を覚えることではなく「何と何を区別すればいいか」です。初心者のうちは、似た言葉をまとめて理解しがちです。だからまず、投稿の中心語を一つ選び、何を指していて、何を指していないのかを分けます。`,
            ["専門用語は一言で言い換える", "似ているものとの違いを見る", "覚えるより使いどころをつかむ"],
            lesson.examples,
            "まだ曖昧な言葉や前提を書き出してください。"
          ),
          step(
            2,
            "mechanism",
            "仕組み",
            "なぜこの方法や考え方が機能するのですか？",
            `${lesson.mechanism}\n\n仕組みは、入力、処理、出力に分けると急にわかりやすくなります。入力は最初に入れるもの、処理は中で起きること、出力は最後に得られる結果です。この3つに分けると、どこを変えれば結果が変わるのかが見えてきます。`,
            ["入力・処理・出力に分ける", "何が結果を変えているかを見る", "成立する条件と失敗する条件を分ける"],
            lesson.examples,
            "なぜこの考え方が役に立つのかを一文で書いてください。"
          ),
          step(
            3,
            "practical_steps",
            "実践手順",
            "自分が試すなら、最初の3ステップは何ですか？",
            "学んだ内容を使うには、最初から大きく変えないことが大切です。小さく試せる手順にします。ここでは、投稿の考え方をそのまま信じるのではなく、必要条件、つまり「これがないと成立しにくいもの」を確認してから、自分の作業に当てはめます。",
            [...lesson.practicalSteps, "うまくいかない反例を1つ考える"].slice(0, 4),
            lesson.examples,
            "今日試せる最初の一歩を書いてください。"
          ),
          step(
            4,
            "examples",
            "具体例",
            "自分のテーマなら、どんな具体例になりますか？",
            `具体例にすると理解が定着します。${lesson.topic}を、あなたのテーマや読者の悩みに置き換えて説明してみます。さらに、境界事例、つまり当てはまるか迷う例も見ると、どこまで使える考え方なのかがはっきりします。`,
            ["当てはまる例を見る", "当てはまらない例を見る", "判断に迷う例で境界線を引く"],
            lesson.examples,
            "自分の読者向けの例を書いてください。"
          ),
          step(
            5,
            "try_with_theme",
            "自分のテーマで試す",
            "この学びを、どのテーマで試しますか？",
            "テーマを決めるとアウトプットに変わります。保存した情報を、あなたの発信や仕事の文脈に接続します。",
            ["テーマを一つ選ぶ", "使う媒体を決める", "読者の悩みに合わせる"],
            ["X投稿にする", "noteの見出しにする", "セミナー資料の1枚にする"],
            "試すテーマと媒体を書いてください。"
          ),
          step(
            6,
            "comprehension_check",
            "理解チェック",
            "誰かに説明するとしたら、どう説明しますか？",
            "最後に説明できるか確認します。説明できる形になれば、単なる保存ではなく使える知識になります。",
            ["一文で説明する", "例を添える", "次に使う場面を書く"],
            ["この投稿から学べるのは、情報ではなく構造を見ることだと説明する"],
            "一文説明と具体例を書いてください。"
          ),
        ];

  return { steps };
}

export function createFallbackOutput(input: {
  outputType: "x" | "instagram" | "note" | "markdown_log" | "seminar";
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
      content: `${summary}\n\n保存した投稿から学べるのは、情報そのものより「どう自分の仕事に置き換えるか」。一度、自分のテーマで使える形に言い換えてみる。${note ? "\n\n#AI活用 #学び" : "\n\n#AI活用 #学び"}`,
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

  return {
    title: "Markdown学習ログ",
    content: `# 学習ログ\n\n## 投稿の要点\n${summary}\n\n## 学びのポイント\n- ${input.classification.recommendReason}\n- 自分のテーマに置き換える\n- 次の発信や実務に使える形にする\n\n## 自分のメモ\n${input.userFinalNote || "未記入"}`,
  };
}
