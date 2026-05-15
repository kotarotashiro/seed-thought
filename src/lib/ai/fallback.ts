import type {
  DeepDiveStepContent,
  GeneratedDeepDiveSessionResult,
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
  const firstSentence = compact.split(/[。！？!?]/)[0] || compact;
  if (firstSentence.length <= 70) {
    return `${firstSentence}、という視点を提示している投稿です。`;
  }
  return `${trimJapanese(firstSentence, 72)}について、要点や考え方を共有している投稿です。`;
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
            "この投稿から、何を学ぶと実務に使えそうですか？",
            `この投稿は${category}の学習素材として使えます。まず、知識として覚える部分と、実際に試す部分を分けて整理します。`,
            ["学ぶ対象を決める", "実務への使い道を見る", "後で試せる形にする"],
            ["投稿の考え方を自分の発信テーマに置き換える", "手順や構造をチェックリスト化する"],
            "学びたいことを一つ選んでください。"
          ),
          step(
            1,
            "basics",
            "基礎知識",
            "理解するために必要な基礎知識は何ですか？",
            "基礎を押さえると、投稿の表面的な情報だけでなく、なぜそれが有効なのかまで理解できます。",
            ["用語を確認する", "背景を押さえる", "前提条件を見る"],
            ["対象者、目的、成果指標を分ける", "ツール名と使い方を切り分ける"],
            "知らない言葉や前提を書き出してください。"
          ),
          step(
            2,
            "mechanism",
            "仕組み",
            "なぜこの方法や考え方が機能するのですか？",
            "仕組みを理解すると、別のテーマにも応用できます。投稿の中の因果関係を、入力、処理、結果に分けて見ます。",
            ["原因と結果を分ける", "再現条件を見る", "応用できる形にする"],
            ["情報を整理することで判断が早くなる", "導線を減らすことで迷いが減る"],
            "なぜうまくいくのかを一文で書いてください。"
          ),
          step(
            3,
            "practical_steps",
            "実践手順",
            "自分が試すなら、最初の3ステップは何ですか？",
            "実践に移すには、小さく試せる手順へ落とします。完璧な計画より、今日できる一歩にするのが大事です。",
            ["最小手順にする", "必要な材料を確認する", "完了条件を決める"],
            ["投稿テーマを一つ選ぶ", "自分の読者向けに言い換える", "短い投稿案にする"],
            "今日試せる最初の一歩を書いてください。"
          ),
          step(
            4,
            "examples",
            "具体例",
            "自分のテーマなら、どんな具体例になりますか？",
            "具体例にすると、自分の理解の穴が見えます。読者や顧客に説明するつもりで、身近な例に置き換えます。",
            ["読者に近い例にする", "一つの場面に絞る", "成果が見える形にする"],
            ["AI活用なら、作業時間が減る場面で説明する", "LINE導線なら、予約までの流れで説明する"],
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
