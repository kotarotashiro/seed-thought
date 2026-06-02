import { getProfile } from "@/lib/profile/fixedProfile";
import type {
  ChatMessage,
  ClassifyPostInput,
  GenerateOutputInput,
  GeneratedOutputResult,
  NoteSection,
  PostContext,
  PostSummaryForSearch,
  PostSummaryForTrend,
  SourcePostForLearning,
  TranslateTextInput,
} from "./types";
import { strictLearningKnowledge, beginnerTeachingRules } from "./knowledge";
import { outputDesignCore, outputMediumKnowledge, outputSelfReview } from "./outputKnowledge";
import { KOTARO_LENS_PROFILE } from "./userLens";

export async function buildClassifyPrompt(input: ClassifyPostInput): Promise<string> {
  const profile = await getProfile();
  return `あなたはSNS投稿の分類エキスパートです。

以下の投稿を分析し、JSON形式で返してください。

## ユーザープロフィール
名前: ${profile.name}
役割: ${profile.role}
テーマ: ${profile.themes.join("、")}
出力チャンネル: ${profile.outputChannels.join("、")}
トーン: ${profile.tone}${profile.knowledge ? `\nナレッジ・コンテキスト: ${profile.knowledge}` : ""}

## 投稿本文
${input.text}

${input.articleContent ? `## 投稿が指すリンク先記事の本文（要約・分類はこちらを優先）
${input.articleContent}
` : ""}
${input.authorName ? `投稿者: ${input.authorName}` : ""}
${input.authorUsername ? `アカウント: @${input.authorUsername}` : ""}

## 出力形式（必ず以下のJSONのみ返してください）
{
  "postType": "thought" | "learning" | "output_material" | "unknown",
  "primaryCategory": "カテゴリ名",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "summary": "投稿の要点を40-60文字で簡潔に要約。ツール名・技術名（Claude, ChatGPT, Cursor等）は省略せず記載。「●●を使って○○する方法」「●●で○○が可能」のような具体的・実用的な一文にする。抽象的な表現は避ける",
  "recommendReason": "ユーザーのプロフィールに照らして、なぜ学習する価値があるか（80-120文字）",
  "difficultyLevel": "beginner" | "intermediate" | "advanced" | "unknown",
  "thinkingPotentialScore": 0-100,
  "learningPotentialScore": 0-100,
  "outputPotentialScore": 0-100,
  "recommendedMode": "unknown"
}

## 分類基準
- thought: 抽象的、哲学的、視点系、思想系の投稿
- learning: ノウハウ、技術、手順、具体的な方法論の投稿
- output_material: 発信のネタ、テンプレ、構造が参考になる投稿
- thinkingPotentialScore: 思考の深掘りに向いている度合い
- learningPotentialScore: 学習・スキルアップに向いている度合い
- outputPotentialScore: アウトプット・発信素材として使える度合い

JSONのみ返してください。説明文は不要です。`;
}

export function buildTranslatePrompt(input: TranslateTextInput): string {
  return `以下のSNS投稿を、日本語で自然に読める文章に翻訳してください。

## ルール
- 意味を補いすぎず、投稿者のニュアンスを保つ
- URLやメンションは必要なら残す
- 解説ではなく翻訳だけを書く
- JSONのみ返す

## 投稿
${input.text}

## 出力形式
{
  "translatedText": "日本語訳"
}`;
}

// 入力（投稿本文・記事本文・動画文字起こし）が長すぎると、LLMの所要時間が
// 出力前から押し上げられ、Kimi k2.6 では300秒の壁を超える原因になる。
// 生成前に各入力へ上限を設けて切り詰める（B: 入力上限）。
const MAX_POST_TEXT_CHARS = 4000;
const MAX_ARTICLE_CHARS = 6000;
const MAX_TRANSCRIPT_CHARS = 8000;
const MAX_IMAGE_CHARS = 4000;

function truncateForPrompt(text: string | undefined | null, max: number): string | undefined {
  if (text == null) return undefined;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…（長いため省略：全${text.length}文字中${max}文字まで）`;
}

// content/format モードで共通の役割設定
function learningModeInstruction(input: SourcePostForLearning): string {
  const mode = input.learningMode ?? "content";
  return mode === "content"
    ? `あなたは「勉強のできる解説者」です。
ユーザーが保存したX投稿について、ユーザーが一段深く理解できるように整理します。

役割は投稿の要約整理ではありません。役割は以下の3つです：
1. 投稿の内容を正確に・敬意をもって理解する（持論で歪めない）
2. 投稿の周辺情報（原典・時代背景・類似フレームワーク等）を補足し、投稿を理解するための地図を作る
3. ユーザーが自分の言葉で考えるための材料を揃える

- 投稿のテーマ領域に踏み込んで、内容として学ぶ
- 投稿者の主張・根拠・推奨アクションを尊重する
- ツリー投稿が含まれている場合は、ツリー全体を1つの教材として扱う`
    : `あなたは、X投稿を発信者視点で分析し、再利用可能な「型」を抽出するAIです。

重要なのは、投稿を保存することではなく、投稿の中にある
「構造」「手順」「発想」「応用可能な型」を抽出することです。`;
}

// 投稿データ・記事・動画文字起こしの共通入力ブロック（上限つき）。
// 本体プロンプト/補足プロンプトの両方が同じ素材を見られるようにする。
function buildLearningInputBlock(input: SourcePostForLearning): string {
  const articleDescription = truncateForPrompt(input.articleDescription, MAX_ARTICLE_CHARS);
  const videoTranscript = truncateForPrompt(input.videoTranscript, MAX_TRANSCRIPT_CHARS);
  // 画像の中身（ビジョンモデルが読み取ったテキスト/図の説明）を専用セクションで明示する。
  // 「画像で示す」とだけ書かれた投稿でも、中身まで踏み込んで学習できるようにする。
  const imageDescriptions = (input.media ?? [])
    .map((m) => truncateForPrompt(m.description, MAX_IMAGE_CHARS))
    .filter((d): d is string => Boolean(d));
  const imageBlock = imageDescriptions
    .map((d, i) => `### 画像${i + 1}\n${d}`)
    .join("\n\n");
  // 巨大ツリー対策：JSON に載せる本文系フィールドも切り詰めてから整形する。
  // 画像説明は上の専用セクションで渡すため、JSON 側の media からは除いて重複と肥大化を防ぐ。
  const trimmedInput: SourcePostForLearning = {
    ...input,
    text: truncateForPrompt(input.text, MAX_POST_TEXT_CHARS) ?? input.text,
    translatedText: truncateForPrompt(input.translatedText, MAX_POST_TEXT_CHARS),
    articleDescription,
    videoTranscript,
    media: input.media?.map(({ description: _description, ...rest }) => rest),
  };

  return `${input.articleTitle || articleDescription ? `## 記事情報（投稿リンク先の内容）
${input.articleTitle ? `タイトル: ${input.articleTitle}` : ""}
${articleDescription ? `内容: ${articleDescription}` : ""}
` : ""}${videoTranscript ? `## 動画文字起こし（ユーザーが貼り付けた動画の文字起こしテキスト）
${videoTranscript}
` : ""}${imageBlock ? `## 画像の内容（投稿に添付された画像をAIが読み取ったもの。本文と同等に重視すること）
${imageBlock}
` : ""}## 投稿データ
${JSON.stringify(trimmedInput, null, 2)}`;
}

// 学習カードは1ショットだと出力JSONが巨大で、Kimi k2.6 では300秒を超えて打ち切られる。
// 出力を「本体」と「補足」に分け、provider 側で Promise.all 並列実行して体感時間を
// max(本体, 補足) ≒ 半分に抑える（A: 並列2分割）。本体が主役、補足は best-effort。

// ① 本体：投稿の中身そのもの＋実践材料（title/summary/capture/steps/応用/tips/useCases）
export function buildLearningCorePrompt(input: SourcePostForLearning): string {
  return `${learningModeInstruction(input)}

${buildLearningInputBlock(input)}

## あなたの出力（必須・全フィールドを必ず埋める）

以下のJSON構造で返してください。必須フィールドを省略しないこと。該当しないサブフィールドは null/空配列でOK。
これは学習カードの「本体（中身そのもの）」を作る工程です。初心者補足・図解・周辺情報は別工程で作るため、ここでは出力しないこと。

{
  "sourcePostId": "${input.id}",
  "title": "学習カードのタイトル（バズタイトル禁止、構造的に）",
  "summary": "一言でいうと（オリエンテーション。1〜2文、長くしない）",
  "originalIntent": "投稿者が本当に伝えたかったこと",
  "whyForYou": "なぜこの投稿を見る価値があるか（1〜2文）",
  "capture": {
    "format": "list | steps | claims | template | narrative のいずれか",
    "headline": "投稿の中身を一言で表す見出し（例: コンバートするヒーローの10要素）",
    "items": [
      { "label": "見出し/要素名/手順名", "body": "投稿が言っている中身そのもの（一文）", "detail": "必要なら補足。不要なら省略" }
    ],
    "verbatim": "format=template のときのみ：プロンプト/テンプレの原文をそのまま。それ以外は null",
    "usage": "format=template のときのみ：使うときの手順。それ以外は null"
  },
  "steps": [
    { "title": "手順名", "description": "説明", "actions": ["具体アクション1", "具体アクション2"] }
  ],
  "applicationIdeas": [
    { "title": "応用アイデア", "description": "説明" }
  ],
  "tips": ["うまく使うコツ1", "コツ2"],
  "useCases": ["向いている用途1", "用途2"]
}

## ① capture（投稿の中身）の作法 ＝ このカードの主役
投稿の中身そのものを取り出すセクション。何も知らない人がこの通りやれば同じ結果になる粒度で、中身を忠実に転写する。
- 投稿の型を見て format を選ぶ：リスト型（例: 10の要素）→ list で要素を“全部”列挙／手順型 → steps／主張の列挙 → claims／プロンプト・テンプレ → template（原文を verbatim にそのまま）／地の文中心 → narrative
- 「10個ある」と数だけ言って中身を省略するのは禁止。10個あるなら items に10個全部入れる
- 抽象化・批評・自分の言葉への変換はしない（それは別セクションの仕事）
- 投稿のノイズ（煽り・自分語り・宣伝・URL・CTA）は削り、価値のある中身だけ残す

${KOTARO_LENS_PROFILE}

## 最終確認
- すべての必須フィールドを省略しない
- 投稿の内容に忠実に、Kotaroの持論をねじ込まない
- 投稿が興味の核に自然に接続するときだけ、自然に指摘する（無理に接続しない）
- 日本語として正しい表記にする。誤変換・中国語/英単語の生混入を避ける（×完美主義→○完璧主義、×鶏呑み→○鵜呑み、英単語の生混入禁止）
- JSONのみ返してください。説明文・前置きは不要です`;
}

// ② 補足：初心者ゾーン・図解・解説画像プロンプト・学習メモ・周辺情報
export function buildLearningSupplementPrompt(input: SourcePostForLearning): string {
  return `${learningModeInstruction(input)}

${buildLearningInputBlock(input)}

## あなたの出力（必須・全フィールドを必ず埋める）

これは学習カードの「補足（理解を助ける周辺情報）」を作る工程です。投稿の中身そのもの（手順・要素の列挙）は別工程で作るため、ここでは扱わない。
以下のJSON構造で返してください。該当しないサブフィールドは null/空配列でOK。

{
  "beginnerZone": {
    "stumblingPoints": [
      { "point": "初心者がつまずく所", "explanation": "やさしくかみくだいた補足" }
    ],
    "glossary": [
      { "term": "用語", "explanation": "初心者にもわかるやさしい解説" }
    ]
  },
  "diagramStructure": {
    "title": "図解タイトル",
    "sections": [
      { "heading": "見出し", "body": "本文", "visualIdea": "視覚表現案" }
    ]
  },
  "imageExplanationPrompt": "解説画像生成用プロンプト",
  "userLearningMemo": "あとで見返すための学習メモ",
  "backgroundContext": {
    "postType": "判定タイプ（例: 既存概念の解説/著者の経験/ハウツー/統計/エッセイ/製品紹介/感想）",
    "origin": "原典・出典詳細（年・著者・公式URL等）。該当しない場合は null",
    "historicalContext": "時代背景・なぜこの主張が生まれたか。該当しない場合は null",
    "relatedFrameworks": [
      { "name": "類似フレームワーク名", "description": "説明", "relation": "どう似ているか・違うか" }
    ],
    "referencedWorks": [
      { "name": "投稿で言及されている本・人物・概念", "context": "補足説明" }
    ],
    "furtherReading": [
      { "topic": "もっと知りたい人へのトピック", "reason": "なぜそれを読むと良いか" }
    ]
  }
}

## ③ beginnerZone（初心者ゾーン）の作法
${beginnerTeachingRules}
- stumblingPoints: 初心者がこの投稿を読んで「ここで詰まる」「この意味がわからない」だろう所を先回りして補う
- glossary: 投稿に出てくる専門用語を、初心者にもわかるやさしい言葉で解説する

## 周辺情報（backgroundContext）の作法
「勉強できる人」として、投稿を理解するための周辺情報を提供する。
まず投稿のタイプを判定し、活きるフィールドのみを埋める：
- 既存概念・著作・出来事の解説 → 原典・時代背景・類似フレームワーク全て
- 著者の経験・気づき → 類似する考え方が中心、原典は「投稿者自身の主張」
- ハウツー・チュートリアル → 公式ソース・代替手段・用語解説
- 統計・データ・ニュース → 一次ソース・推移・関連レポート
- エッセイ・思想・社会論 → 類似する論者・批判的見解
- 短い感想・ジョーク・ミーム → 周辺情報はほぼ空でよい

該当しないサブフィールドは null または空配列 []。不確かな情報は「諸説あり」と明示。
推測ではなく事実ベース。AIが知らない領域は素直に簡潔に。網羅より厳選（各3〜5個まで）。

## 最終確認
- diagramStructure を必ず埋める
- 投稿の内容に忠実に、Kotaroの持論をねじ込まない
- 日本語として正しい表記にする。誤変換・中国語/英単語の生混入を避ける（×完美主義→○完璧主義、×鶏呑み→○鵜呑み、英単語の生混入禁止）
- JSONのみ返してください。説明文・前置きは不要です`;
}

export async function buildStrictLearningPrompt(input: {
  postText: string;
  classification: { primaryCategory: string; summary: string };
  articleTitle?: string;
  articleDescription?: string;
  learningCardJson?: string;
  userMemo?: string | null;
}): Promise<string> {
  const profile = await getProfile();

  const articleSection =
    input.articleTitle || input.articleDescription
      ? `## 元投稿が参照している記事本文（必ずこちらを主な分析対象にすること）
${input.articleTitle ? `タイトル: ${input.articleTitle}\n` : ""}${input.articleDescription ? `本文:\n${input.articleDescription}\n` : ""}
注意: 元投稿に含まれる t.co などの短縮URLそのものを主題として扱ってはならない。上記の記事本文の内容を主題として厳密学習を構築すること。
`
      : "";

  return `あなたはSeedThoughtの専属学習コーチです。
保存済み投稿を、さとり式「厳密学習」のテンプレートに沿って1ショットで構造化してください。

${KOTARO_LENS_PROFILE}

## 元投稿
${input.postText}

${articleSection}
## 投稿分類
カテゴリ: ${input.classification.primaryCategory}
要約: ${input.classification.summary}

${input.learningCardJson && input.learningCardJson !== "{}" ? `## 学習カードの既存解析（参考）\n${input.learningCardJson}\n` : ""}
${input.userMemo ? `## ユーザーメモ\n${input.userMemo}\n` : ""}

## 厳密学習OS（必ず参照してください）
${strictLearningKnowledge}

## 出力ルール
- 元投稿の固有の言葉・文脈を使うこと。汎用的な自己啓発文にしないこと
- 正例・反例・境界事例は、投稿の領域に即した具体例にすること
- 暗黙の前提（assumption）と限界（limit）は、投稿が触れていない部分を補う形で
- 反例・境界事例は「ありがち」ではなく「鋭い」ものを。投稿の主張がどこで崩れるかを示す
- 「自分に使うなら（applyToYourself）」はユーザーの興味の核と自然に接続する場合のみ具体化。
  接続しない投稿なら「この投稿は ${profile.themes.join("・")} から離れた領域だが、◯◯の観点で参照価値がある」と素直に書く
- 15分ワークは、机上のメモではなく、実際に15分で成果物が一つ残る手順にすること
- 抽象論で終わらず、必要条件・典型特徴・本質を明確に分けること
- 持論（INFJ／意志vs仕組み等）を毎回ねじ込まない。投稿が自然にその領域に触れる場合のみ参照

## 出力形式（必ず以下のJSONのみ。説明文は不要）
{
  "title": "厳密学習: 〜（一言でいうとの内容を要約したタイトル、40文字以内）",
  "content": "oneLinerとwhyItMattersをそのまま読めるテキストとして結合した短いプレーンテキスト",
  "contentJson": {
    "oneLiner": "一言でいうと（40-80文字、投稿の本質を凝縮）",
    "whyItMatters": "何が重要なのか（120-200文字、なぜユーザーにとってこの学びが価値あるか）",
    "prerequisites": "前提知識（80-160文字、これを理解するために必要な土台）",
    "claimBreakdown": {
      "claim": "投稿の主張を一文で",
      "background": "背景・文脈",
      "assumption": "暗黙の前提",
      "evidence": "主張を支える根拠",
      "counterExample": "反例・成立しないケース",
      "limit": "限界・適用範囲"
    },
    "strictLearningView": {
      "positiveExamples": ["正例1（当てはまる具体例）", "正例2", "正例3"],
      "negativeExamples": ["反例1（似ているが違う例）", "反例2"],
      "boundaryExamples": ["境界事例1（判断が難しい例）", "境界事例2"],
      "necessaryConditions": ["必要条件1", "必要条件2"],
      "typicalFeatures": ["典型特徴1（よく見られるが本質ではない）", "典型特徴2"],
      "essence": "典型特徴と分けた本質（80-160文字）"
    },
    "abstraction": "抽象化すると（80-160文字、構造として一段抽象化）",
    "transferToOtherFields": [
      { "field": "別分野名1", "application": "どう転用できるか（60-120文字）" },
      { "field": "別分野名2", "application": "どう転用できるか" }
    ],
    "applyToYourself": "自分に使うなら（120-240文字、ユーザーのテーマ・役割に即した使い方）",
    "fifteenMinuteExercise": {
      "goal": "15分で達成するゴール",
      "steps": ["手順1", "手順2", "手順3", "手順4"],
      "deliverable": "15分後に残る成果物"
    }
  }
}

JSONのみ返してください。説明文は不要です。`;
}

// 学習カードの分析（①投稿の中身 / ②背景・本質 / ③初心者ゾーン等）を素材ブロックに整形する。
// 下書きと改稿の両方に同じ素材を渡し、改稿が下書きの要約だけを頼りに薄くなるのを防ぐ。
function buildLearningMaterialBlock(steps: GenerateOutputInput["steps"]): string {
  return steps
    .map((s, i) => `### ステップ${i + 1}: ${s.title}\n問い: ${s.question}\nAI解説: ${s.aiContent}\nユーザーメモ: ${s.userNote || "なし"}`)
    .join("\n\n");
}

export async function buildOutputPrompt(input: GenerateOutputInput): Promise<string> {
  // 「本質を絞る」(旧 strict_learning) は発信アウトプットではなく、学習カードのオンデマンド深掘り。
  // 専用ルート (./learning/strict) で生成するため、ここでは扱わない。
  const stepsContext = buildLearningMaterialBlock(input.steps);

  const outputTypeLabel: Record<string, string> = {
    x: "短く伝える（X投稿・280文字以内）",
    instagram: "図で伝える（Instagramカルーセル）",
    short_video: "動画で伝える（ショート動画台本・30〜45秒）",
    note: "じっくり読ませる（note記事・読み応えのある解説。素材に応じた長さ）",
    markdown_log: "学習ログ（Markdown形式）",
    seminar: "セミナーを作る（スライド構成＋台本）",
  };

  // 発信ナレッジ（媒体別の構成＋読者を動かす内部設計）。
  // セミナーは専用の詳細指示があるため除外。
  // note は「一人称の思考エッセイ」方式の専用指示を本体に持つため、売り込み型の共通設計
  //（outputDesignCore=対象者を刺す/ベネフィット/CTA、outputSelfReview）は混ぜず、本体指示に委ねる。
  const mediumKnowledge =
    input.outputType === "seminar" || input.outputType === "note"
      ? ""
      : [outputDesignCore, outputMediumKnowledge[input.outputType] ?? "", outputSelfReview]
          .filter(Boolean)
          .join("\n\n");

  const authorRef = input.postAuthorUsername
    ? `@${input.postAuthorUsername}${input.postAuthorName ? `（${input.postAuthorName}）` : ""}`
    : input.postAuthorName ?? "元投稿者";

  return `あなたはSNSキュレーター・解説者です。
ユーザーが価値を感じた他者の投稿を、わかりやすく他の人に伝え直すコンテンツを生成します。

${KOTARO_LENS_PROFILE}

## 重要ルール（持論ねじ込みを避ける）
- 元投稿の文章をそのまま転載しない
- **投稿の内容が主役**。プロフィールはトーン・文体の基準として使う。持論を毎回挟まない
- 「${authorRef}の投稿から学んだ・気づいた」という解説者の視点で書く
- 出典（${authorRef}）を自然な形で明示する
- 投稿が自然にユーザーの興味の核に接続する場合のみ、自然な形で言及する。
  接続しない投稿なら、投稿の良さをそのまま伝える側に振り切る
- ユーザー自身の解釈・補足は「特に響いた一点」「自分も試したい」程度の自然な反応に留める
- 「印象的でした」「すごい」「ぜひ」「いかがでしたか」のような浅い表現は使わない

## 元投稿（${authorRef}、転載禁止）
${input.postText}

## 学習カードの分析（これを発信の素材にする。中身・背景・本質を活かす）
${stepsContext}

## ユーザーの最終メモ
${input.userFinalNote || "なし"}

## 最終サマリー
${input.finalSummary || "なし"}
${mediumKnowledge ? `\n${mediumKnowledge}\n` : ""}
## 出力形式: ${outputTypeLabel[input.outputType] || input.outputType}

${input.outputType === "note" ? `あなたは note 記事の書き手です。${authorRef} の投稿から得た学びを、一本の思考ラインとして一人称で語り直します。中立的な「解説・レビュー」ではなく、「自分が考えたこと」として読める記事にしてください。読者は「この人の話だ」と感じて読み進めます。

## 最優先の絶対ルール（破ったら失格）
ここは「声は一人称でよいが、事実は捏造しない」の線引きが核心です。
- 【禁止】出典のない**数字・統計・割合・具体的な実績・固有名（企業/製品/人名）・具体的な出来事**を創作しない。
  （×「言及回数が2倍になった」「達成率が30%から55%に」「A社で導入され」のような検証可能な作り話）
- 【禁止】検証可能な経歴・肩書・実体験の詳細を創作しない（×「3年間で100社を支援した」等の具体的経歴）。
- 【許可】一人称の語り口・思考の声・共感の枠組みは使ってよい（○「この問いに何度もぶつかってきた」「かつての自分もそうだった」「今なら言語化できる」）。これは読者を引き込む装置であり、嘘の事実ではない。
- 一般論を例で示すときは「たとえば〜なら」「仮に〜だとすると」と仮定を明示し、実際に起きた事実だと誤読させない。数字は付けない。
- 字数を埋めるための創作は厳禁。素材を使い切れば自然に厚くなる。長さより正直さを優先する。

## 素材の4層仕分け（書く前に必ず分類する）
渡された学習カードの素材を、次の4層に仕分けてから使う。
- **論点層**（投稿の中身＝番号付きの主張群）→ 記事の骨格。**1つも落とさず全て使う**。
- **補助層**（初心者のつまずき・用語解説・正例/反例）→ 独立セクションにしない。**本文に溶かす**。
  - つまずきポイントは「読者が反発・誤解しそうな箇所」なので、本文中で**想定反論として先回りして処理**する（例: 強い主張の直後に「これは〜を否定しているわけではない」と留保を置く）。
  - 用語の定義は用語集にせず、本文中で自然に言い添える（例:「対価とは金銭だけでなく〜」）。
- **拡張層**（背景・時代文脈・類似フレームワーク・他分野転用・参考文献）→ **原則使わない**。
  外部フレームワークの引用は記事を「解説・レビュー」のトーンにし、一人称の体験密度を薄めるため。権威づけより筋の通った思考を優先する。
- **実践層**（15分ワーク・応用アイデア・コツ）→ **1つだけ**選び、締めに「読者が手を動かせるパーツ」として置く。応用アイデアは入れても1つだけ本文に溶かす。

## 構造＝一本の思考ライン（解説書にしない）
論点層を「1つの問い → 展開 → 着地」の流れに再編成する。各論点を並べた8セクションの解説書にはしない。movements は次の順:
1. **共感フック**（読者の感情を起点に。「頑張っているのに報われない」のような、読者が抱える問いから入る。一人称の実感で「この人の話だ」と感じさせる）
2. **前提提示**（記事全体の土台になる主張を最初に置く）
3. **定義の拡張**（読者が誤解しがちな語の射程を広げて誤解を壊す）
4. **条件の追加**（主張に必要な条件を足して立体化する）
5. **想定反論の処理**（読者が抱きそうな反論を取り上げ、構造で答える）
6. **実践への変換**（考え方を、読者が今日できる具体的な行動・記録法に落とす）
7. **構造のまとめ＋ワーク**（論点を数個の条件に圧縮して締め、実践層のワークを1つ置く）
- 見出しは「出会い」「まとめ」のような汎用ラベルではなく、その節の主張を表す**断定形**にする（例:「プロセスに対価は発生しない」）。movements は厳密に7個でなくてよい（素材に応じて統合・分割可）。

## 出力JSON形式
{
  "title": "記事タイトル（バズ禁止。投稿の核心を断定形で表す。例:「『頑張っているのに報われない』の正体——対価はプロセスではなくアウトプットに支払われる」）",
  "content": "",
  "contentJson": {
    "source": "出典を一文で（例: @username（本名）の投稿）",
    "sections": [
      { "heading": "断定形の小見出し", "body": "本文（markdown可）" }
    ]
  }
}

## 文体ルール
- 一人称の実感を入口に使い、読者が「自分の話だ」と感じる冒頭にする
- 強い主張の直後には補足・留保を置く（読者が反発しそうな箇所をケアする）
- 太字（**）は1セクション1箇所に絞る。多用するとスキャン読みされ本文が読まれない
- 箇条書きは最小限（定義の列挙など本当に必要な所だけ）。地の文で語る
- 日本語として自然に音読できる文章にする。一文を長くしすぎず、意味の切れ目に読点（、）を打つ
- 「記事が〜している」「投稿は〜を示している」というメタなぞりは禁止。中身そのものを自分の言葉で書く
- 文末の定型句（「いかがでしたか」「ぜひ」「ありがとうございました」）は禁止
- contentは空文字列でよい。コードがsectionsから組み立てる` : ""}

${input.outputType === "seminar" ? `以下のJSON形式で必ず返してください。contentは一文の要旨のみ。セミナーの全データをcontentJsonに入れること：
{
  "title": "決定したセミナー名",
  "content": "セミナーを一文で表した要旨（finalStatementと同内容でよい）",
  "contentJson": {
    "coreInterpretation": {
      "surface": "投稿が直接言っていること",
      "essence": "本当に重要なポイント（本質）",
      "applicability": "どんな業務・制作・発信に応用できるか",
      "participantPain": "このセミナーが解決する参加者の悩み"
    },
    "titleOptions": [
      { "title": "タイトル", "subtitle": "サブタイトル", "targetAudience": "誰に刺さるか", "oneLiner": "一言で言うと何を学ぶ講座か" }
    ],
    "seminar": {
      "name": "セミナー名",
      "subtitle": "サブタイトル",
      "targetAudience": "対象者",
      "outcomes": ["受講後にできること1", "受講後にできること2"],
      "value": "このセミナーの価値",
      "whyNow": "なぜ今この内容を学ぶべきか"
    },
    "schedule": [
      { "time": "0:00〜0:10", "part": "導入", "content": "内容", "purpose": "目的" }
    ],
    "chapterDetails": [
      {
        "part": "パート名",
        "teachingPoint": "この章で伝えること",
        "script": "話す内容（具体的に）",
        "slideContent": "見せるスライドの内容",
        "demonstration": "実演する場合の具体例",
        "question": "参加者に考えてもらう問い"
      }
    ],
    "demonstration": {
      "theme": "実演テーマ",
      "badExample": "実演前の悪い例",
      "goodExample": "改善後の良い例",
      "prompt": "実際に使うプロンプト",
      "expectedOutput": "期待される出力",
      "showPoints": ["参加者に見せるポイント"]
    },
    "workshop": {
      "name": "ワーク名",
      "purpose": "ワークの目的",
      "steps": ["手順1", "手順2"],
      "fillItems": ["記入項目1", "記入項目2"],
      "completionImage": "完成イメージ",
      "facilitatorTips": ["講師が補足すべきポイント"]
    },
    "templates": {
      "basic": "基本テンプレート（そのままコピーして使える形）",
      "advanced": "応用テンプレート",
      "fixFailed": "失敗したときの修正テンプレート",
      "snsPost": "SNS投稿用テンプレート",
      "seminarMaterial": "セミナー資料用テンプレート",
      "blogNote": "ブログ・note用テンプレート"
    },
    "slides": [
      { "slideNumber": 1, "title": "スライドタイトル", "content": "内容", "visualIdea": "ビジュアル案" }
    ],
    "promotion": {
      "xPost": "X投稿用告知文",
      "instagram": "Instagram投稿用告知文",
      "line": "LINE配信用告知文",
      "noteIntro": "note記事冒頭文",
      "lpCopy": "LPファーストビューコピー"
    },
    "salesFunnel": {
      "nextProduct": "セミナー内で案内する次の商品",
      "consultationBridge": "個別相談へのつなげ方",
      "templateSales": "有料テンプレート販売案",
      "continuationCourse": "継続講座にする場合の発展案"
    },
    "finalStatement": "このセミナーは、〇〇を学ぶ講座ではなく、〇〇できるようになる講座です"
  }
}
スライドは15〜25枚程度で構成してください。` : `以下のJSON形式で返してください：
{
  "title": "タイトル",
  "content": "本文内容",
  "contentJson": { /* 必要に応じた構造データ */ }
}`}

${input.outputType === "instagram" ? `
Instagramカルーセルの場合、contentJsonに以下を含めてください:
{
  "slides": [
    { "slideNumber": 1, "heading": "見出し", "body": "本文", "note": "補足" }
  ]
}
` : ""}

${input.outputType === "x" ? `X投稿（短く伝える）の構成:
  ${authorRef}の投稿の核 (1〜2文)
  ＋ 特に響いた一点 (1文)
  ＋ 自然な感想 or 自分も試したい点 (1文)
280文字以内。ハッシュタグは0〜2個。煽り禁止。` : ""}

${input.outputType === "short_video" ? `ショート動画（動画で伝える）の台本:
content には、視聴者がそのまま撮れる台本を入れる。各パートを「ナレーション」と「テロップ」に分けて書く:
  0〜3秒（フック）/ 3〜8秒（共感）/ 8〜18秒（問題の本質）/ 18〜30秒（解決策・具体例）/ 30〜40秒（ベネフィット）/ 最後（CTA）
contentJson には以下を含める:
{
  "segments": [
    { "time": "0〜3秒", "role": "フック", "narration": "話す内容", "telop": "大きく出す短いテロップ" }
  ],
  "caption": "投稿に添える説明文（任意）"
}
話し言葉で。テロップは話す内容を全部書かず、刺さる一言だけにする。` : ""}

${input.outputType === "markdown_log" ? `学習ログ (Markdown) の構成:
  # ${authorRef}の投稿から学んだ・気づいた
  ## 投稿の整理（出典明示）
  ## Why this matters to me（自然に接続するときのみ。無理に書かない）
  ## 接続したい既存の概念・知識（あれば）
  ## 次の一手
構造化された記録。後で他の知識と接続できる形に。` : ""}

${input.outputType === "seminar" ? `
あなたは、保存済みコンテンツから「実践型セミナー」を設計する専門家です。
投稿内容をそのまま紹介するのではなく、その背後にあるノウハウの本質を抽出し、
参加者が実際に使えるスキル・テンプレート・手順として持ち帰れる90分講座にしてください。

以下の思考プロセスで設計してください:
1. 投稿の表面的な内容を整理する
2. 本質的なノウハウを抽出する
3. どんな人のどんな課題を解決するかを考える
4. セミナーとして成立するテーマに広げる
5. 参加者が最後に何をできるようになるべきかを決める
6. 講義・実演・ワーク・テンプレート配布を含めた90分講座にする

必ず守ること:
- 「この投稿について学ぶセミナー」ではなく「このノウハウを使えるようにするセミナー」にする
- 具体例・実演・ワークを必ず入れる
- 受講後に使えるテンプレートを必ず作る
- セミナー告知文も作る
- 抽象論だけでなく、実際に使える手順まで落とし込む` : ""}

JSONのみ返してください。`;
}

/** note の安全網としての下限（これ未満は明らかに薄いので一度だけ深掘りを試す）。
 *  「正直な解説」方針のため、字数は品質の核ではない。捏造で埋めるくらいなら短くてよい。 */
export const MIN_NOTE_CONTENT_CHARS = 1500;
/** 各セクションの目安下限字数（これ未満のセクションを深掘り候補にする）。 */
export const MIN_NOTE_SECTION_CHARS = 300;

/**
 * note 拡張パス。初回生成でセクションの合計字数が下限に届かなかったときのみ呼ぶ。
 * 薄いセクションを「学習カードの実在素材（背景・原理・類似フレームワーク・適用範囲）」で
 * 誠実に深掘りさせる。字数を満たすための創作は禁止。実在素材で伸ばせないなら短いまま返してよい。
 * 1回だけ（provider でガード済み）。
 */
export function buildNoteExpandPrompt(
  authorRef: string,
  sections: NoteSection[],
  currentLen: number
): string {
  const thinSections = sections
    .map((s, i) => ({ i, heading: s.heading, len: s.body.replace(/[\r\n]/g, "").length }))
    .filter((s) => s.len < MIN_NOTE_SECTION_CHARS);

  const sectionsJson = JSON.stringify(sections, null, 2);

  return `あなたはnote記事の編集者です。
以下のnote記事は内容がやや薄いため、特に薄いセクションを「正直な解説」として深掘りしてください。
ただし字数を満たすことが目的ではありません。深掘りできる実在素材がなければ、無理に伸ばさず短いまま返して構いません。

## 薄いセクション（body が${MIN_NOTE_SECTION_CHARS}字未満）
${thinSections.length > 0 ? thinSections.map((s) => `- セクション${s.i + 1}「${s.heading}」: 現在${s.len}字`).join("\n") : "（全セクション基準クリア済み）"}

## 元の sections（これを深掘りして返す）
${sectionsJson}

## 深掘りのルール（絶対）
- 深掘りは「投稿の論の筋・原理・背景・関連概念との違い・適用範囲」など**実在する素材**だけで行う
- 実在しない数字・統計・割合・固有名・事例・体験を一切創作しない（字数稼ぎの捏造は失格）
- 「${authorRef}の投稿が〜している」というメタなぞりは禁止。中身そのものを書く
- 一般論の例示は「たとえば〜なら」と仮定を明示し、数字は付けない
- 文末の定型句（いかがでしたか等）は禁止

以下のJSON形式のみ返してください：
{
  "sections": [ { "heading": "...", "body": "..." } ]
}`;
}

/** 改稿パスを使う媒体と、そのラベル（散文・説得が効く媒体に限定。seminar/markdown_log/note は対象外）。
 *  note はセクション分割1パス生成のため改稿パスを通さない。 */
export const REFINABLE_OUTPUT_TYPES: Record<string, string> = {
  x: "X投稿（280字以内）",
  instagram: "Instagramカルーセル",
  short_video: "ショート動画台本（30〜45秒）",
};

/**
 * 2段生成の「改稿パス」。1回目で書いた下書きを外部入力として渡し、
 * 編集者の視点で厳しく添削させてから書き直させる。
 * 自己添削を同じ生成内でやらせても効かないため、別呼び出しに分けるのが要点。
 * 散文・説得が効く媒体（X / Instagram / 動画 / note）でのみ使用する。
 */
export function buildOutputRefinePrompt(
  input: GenerateOutputInput,
  draft: GeneratedOutputResult
): string {
  const authorRef = input.postAuthorUsername
    ? `@${input.postAuthorUsername}${input.postAuthorName ? `（${input.postAuthorName}）` : ""}`
    : input.postAuthorName ?? "元投稿者";

  const mediumLabel = REFINABLE_OUTPUT_TYPES[input.outputType] ?? input.outputType;
  const mediumKnowledge = [outputMediumKnowledge[input.outputType] ?? "", outputSelfReview]
    .filter(Boolean)
    .join("\n\n");
  const stepsContext = buildLearningMaterialBlock(input.steps);
  const draftJson =
    draft.contentJson && Object.keys(draft.contentJson).length > 0
      ? JSON.stringify(draft.contentJson, null, 2)
      : null;

  return `あなたは発信コンテンツを仕上げる編集者です。
以下は同じ素材から書かれた「下書き」です。${mediumLabel}として、編集者の視点で厳しく添削し、別物の完成度まで書き直してください。
「だいたい良い」で止めず、有料でも読まれる水準を狙ってください。

${KOTARO_LENS_PROFILE}

## この媒体の狙いと構成
${mediumKnowledge}

## 元素材（事実の源。ここから外れた捏造は禁止）
### 元投稿（${authorRef}、転載禁止）
${input.postText}

### 学習カードの分析（発信の素材。①投稿の中身そのもの／②背景・本質／③初心者がつまずく点を活かす）
${stepsContext}

### 最終サマリー
${input.finalSummary || "なし"}

### ユーザーの最終メモ
${input.userFinalNote || "なし"}

## 下書き（これを書き直す）
タイトル: ${draft.title}

本文:
${draft.content}${draftJson ? `\n\n構造データ(contentJson):\n${draftJson}` : ""}

## 添削と改稿の手順（必ずこの順で行う）
1. まず下書きの弱点を遠慮なく挙げる。特に次を疑う:
   - 表面のなぞりで終わっていないか（本質・背景まで踏み込めているか）
   - 安全側に逃げた一般論・体温のない正論になっていないか
   - 冒頭で「誰向けか」が一瞬で分かるか
   - 具体・手触り・固有の視点が足りているか
   - 借り物の言葉・AIっぽい言い回し・浅い表現が混ざっていないか
   - この媒体の読まれ方・文字数・構成に合っているか
   - 学習カードの分析（①投稿の中身・②背景や本質・③初心者のつまずき）を活かしきれているか。下書きが表面の要約やメタななぞりで止まっていないか
2. 挙げた弱点を全て潰すように書き直す。なぞりを具体に、抽象を手触りに置き換え、冗長は削る。
3. この媒体の構成・文字数の制約を必ず守る。

## 厳守
- 元素材にない事実・数字・固有名・体験を捏造しない（盛らない）
- 出典（${authorRef}）は自然な形で残す
- 「いかがでしたか」「ぜひ」「素晴らしい」「印象的でした」等の浅い表現・締めの定型句は使わない
- 下書きが構造データ(contentJson)を持つ媒体（カルーセル・動画台本など）は、同じ構造で改稿版の contentJson を必ず返す

以下のJSON形式で返してください。critique は社内用（本文・UIには出さない）：
{
  "critique": "下書きの弱点（箇条書き）",
  "title": "改稿後のタイトル",
  "content": "改稿後の本文",
  "contentJson": { /* 媒体の構造データ。下書きと同じ形を維持。無ければ {} */ }
}
JSONのみ返してください。`;
}

export function buildSemanticSearchPrompt(query: string, posts: PostSummaryForSearch[]): string {
  const postsJson = JSON.stringify(
    posts.map((p) => ({
      id: p.id,
      summary: p.summary,
      tags: p.tags,
      category: p.primaryCategory,
      type: p.postType,
    }))
  );

  return `あなたはユーザーの悩みや目標に合った投稿を見つける検索エキスパートです。

## ユーザーの検索クエリ
${query}

## 投稿一覧（JSON）
${postsJson}

## タスク
ユーザーの検索クエリに対して、最も関連性の高い投稿を最大10件選んでください。
キーワードの一致ではなく、「この投稿がユーザーの悩みや目標を解決するか」という観点で評価してください。

## 出力形式（JSONのみ）
{
  "results": [
    {
      "postId": "投稿のid",
      "relevanceScore": 1-100,
      "reason": "なぜこの投稿がクエリに関連するか（40-60文字）"
    }
  ]
}

関連性スコアの高い順に並べてください。JSONのみ返してください。`;
}

export async function buildTrendAnalysisPrompt(posts: PostSummaryForTrend[]): Promise<string> {
  const profile = await getProfile();
  const postsJson = JSON.stringify(
    posts.map((p) => ({
      category: p.primaryCategory,
      type: p.postType,
      tags: p.tags,
      difficulty: p.difficultyLevel,
      summary: p.summary,
    }))
  );

  return `あなたはユーザーの学習傾向を分析するアナリストです。

## ユーザープロフィール
名前: ${profile.name}
役割: ${profile.role}
テーマ: ${profile.themes.join("、")}

## いいねした投稿一覧（${posts.length}件）
${postsJson}

## タスク
ユーザーがいいねした投稿のパターンを分析し、学習傾向・興味・強みを明らかにしてください。

## 出力形式（JSONのみ）
{
  "topCategories": ["最も多いカテゴリ1", "カテゴリ2", "カテゴリ3"],
  "favoriteThemes": ["好きなテーマ1", "テーマ2", "テーマ3"],
  "learningStyle": "学習スタイルの説明（50-80文字）",
  "strengths": ["強み・得意分野1", "強み2", "強み3"],
  "recommendedNextTopics": ["次に学ぶと良いトピック1", "トピック2", "トピック3"],
  "summary": "全体的な傾向のまとめ（100-150文字）"
}

JSONのみ返してください。`;
}

export async function buildChatPrompt(
  message: string,
  history: ChatMessage[],
  posts: PostContext[]
): Promise<string> {
  const profile = await getProfile();
  const postsContext = posts
    .map((p, i) => {
      const parts = [`[投稿${i + 1}] ID:${p.id}`];
      if (p.primaryCategory) parts.push(`カテゴリ: ${p.primaryCategory}`);
      if (p.tags?.length) parts.push(`タグ: ${p.tags.join(", ")}`);
      if (p.summary) parts.push(`要約: ${p.summary}`);
      parts.push(`本文: ${p.text.slice(0, 300)}${p.text.length > 300 ? "..." : ""}`);
      if (p.authorUsername) parts.push(`投稿者: @${p.authorUsername}`);
      if (p.sourceUrl) parts.push(`URL: ${p.sourceUrl}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");

  const historyText = history
    .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`)
    .join("\n");

  return `あなたはSeedThoughtのAIアシスタントです。ユーザーが保存した投稿をもとに、質問に答えたり、ノウハウを解説したりします。

## ユーザープロフィール
名前: ${profile.name}
役割: ${profile.role}
テーマ: ${profile.themes.join("、")}

## 参照できる保存投稿
${postsContext}

## 会話履歴
${historyText || "（なし）"}

## ユーザーの質問
${message}

## 回答ルール
- 上記の保存投稿を参考にして回答してください
- 投稿の内容に触れるときは「投稿1によると」「@username の投稿では」のように出典を明示してください
- 投稿に関係ない質問も、プロフィールのテーマに沿って答えてください
- マークダウンで読みやすく整理してください
- 回答は日本語で、${profile.name}さんに向けた丁寧なトーンで書いてください`;
}
