import { getProfile } from "@/lib/profile/fixedProfile";
import type {
  ChatMessage,
  ClassifyPostInput,
  GenerateOutputInput,
  PostContext,
  PostSummaryForSearch,
  PostSummaryForTrend,
  SourcePostForLearning,
  TranslateTextInput,
} from "./types";
import { strictLearningKnowledge } from "./knowledge";

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

export function buildLearningPrompt(input: SourcePostForLearning): string {
  const mode = input.learningMode ?? "content";

  const modeInstruction =
    mode === "content"
      ? `あなたは、X投稿（およびそのツリー）に含まれる事実・知識・手順を、
ユーザーが自分の生活や仕事で実際に使えるように整理する学習コーチです。

重要なのは、投稿を「発信の型」として分析することではなく、
投稿の中で語られている内容そのもの（具体的な手順・知識・推奨事項・データ）を
ユーザーが理解し、実践し、応用できる形に整えることです。

- 投稿のテーマ領域（例：健康・薄毛なら健康分野）に踏み込んで、内容として学ぶ
- 投稿者の主張・根拠・推奨アクションを尊重する
- ユーザープロフィールへの転用は「応用アイデア」セクションでのみ行い、
  要約・構造・手順・マニュアルでは投稿のテーマそのものを扱う
- ツリー投稿が含まれている場合は、ツリー全体を1つの教材として扱う`
      : `あなたは、X投稿を発信者視点で分析し、再利用可能な「型」を抽出するAIです。

重要なのは、投稿を保存することではなく、投稿の中にある
「構造」「手順」「発想」「応用可能な型」
を抽出することです。ユーザーのテーマ（SNS発信・コンテンツ制作）に転用できる
形で構造化してください。`;

  return `${modeInstruction}

以下を必ず出力してください。

1. タイトル
2. 3行要約
3. この投稿が伝えようとしている本質
4. 何が面白いのか
5. 抽出できる構造
6. 実践手順
7. マニュアル化した本文
8. ユーザーの業務への応用アイデア
9. うまく使うコツ
10. 向いている用途
11. 図解・解説画像にするための構成
12. 解説画像生成用プロンプト
13. ユーザーがあとで見返すための学習メモ

出力は必ずJSONで返してください。

## 出力形式
{
  "sourcePostId": "${input.id}",
  "title": "学習カードのタイトル",
  "summary": "3行要約。改行を含めてもよい",
  "originalIntent": "この投稿が伝えようとしている本質",
  "whatIsInteresting": "何が面白いのか",
  "coreInsight": "中心となる洞察",
  "structure": [
    { "label": "構造名", "description": "説明" }
  ],
  "steps": [
    { "title": "手順名", "description": "説明", "actions": ["具体アクション"] }
  ],
  "manual": "実践マニュアル本文",
  "applicationIdeas": [
    { "title": "応用アイデア名", "description": "説明" }
  ],
  "tips": ["うまく使うコツ"],
  "useCases": ["向いている用途"],
  "diagramStructure": {
    "title": "図解タイトル",
    "sections": [
      { "heading": "見出し", "body": "本文", "visualIdea": "視覚表現案" }
    ]
  },
  "imageExplanationPrompt": "解説画像生成用プロンプト",
  "userLearningMemo": "ユーザーがあとで見返すための学習メモ",
  "status": "draft"
}

${input.articleTitle || input.articleDescription ? `## 記事情報（投稿リンク先の内容）
${input.articleTitle ? `タイトル: ${input.articleTitle}` : ""}
${input.articleDescription ? `内容: ${input.articleDescription}` : ""}
` : ""}${input.videoTranscript ? `## 動画文字起こし（ユーザーが貼り付けた動画の文字起こしテキスト）
${input.videoTranscript}
` : ""}投稿データ:
${JSON.stringify(input, null, 2)}

JSONのみ返してください。説明文は不要です。`;
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

## ユーザープロフィール
名前: ${profile.name}
役割: ${profile.role}
テーマ: ${profile.themes.join("、")}
トーン: ${profile.tone}${profile.knowledge ? `\nナレッジ・コンテキスト: ${profile.knowledge}` : ""}

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
- 元投稿の固有の言葉・文脈を使うこと。汎用的な自己啓発文にしないこと。
- 正例・反例・境界事例は、投稿の領域に即した具体例にすること。
- 「自分に使うなら」はユーザープロフィールのテーマに紐づけること。
- 15分ワークは、机上のメモではなく、実際に15分で成果物が一つ残る手順にすること。
- 抽象論で終わらず、必要条件・典型特徴・本質を明確に分けること。

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

export async function buildOutputPrompt(input: GenerateOutputInput): Promise<string> {
  if (input.outputType === "strict_learning") {
    const learningCardJson =
      input.steps.find((s) => s.title === "学習内容")?.aiContent || "{}";
    return buildStrictLearningPrompt({
      postText: input.postText,
      classification: {
        primaryCategory: input.classification.primaryCategory,
        summary: input.classification.summary,
      },
      learningCardJson,
      userMemo: input.userFinalNote ?? null,
    });
  }

  const profile = await getProfile();
  const stepsContext = input.steps
    .map((s, i) => `### ステップ${i + 1}: ${s.title}\n問い: ${s.question}\nAI解説: ${s.aiContent}\nユーザーメモ: ${s.userNote || "なし"}`)
    .join("\n\n");

  const outputTypeLabel: Record<string, string> = {
    x: "X投稿（280文字以内）",
    instagram: "Instagramカルーセル（スライド構成）",
    note: "note記事（1000-2000文字）",
    markdown_log: "Markdown学習ログ",
    seminar: "セミナー（スライド構成＋台本）",
  };

  return `あなたはSNS・コンテンツライターです。

## 重要ルール
- 元投稿の文章をそのまま転載しないでください
- ユーザーの理解メモと考えを中心に、自分の言葉として使えるアウトプットを生成してください

## ユーザープロフィール
名前: ${profile.name}
役割: ${profile.role}
テーマ: ${profile.themes.join("、")}
出力チャンネル: ${profile.outputChannels.join("、")}
トーン: ${profile.tone}${profile.knowledge ? `\nナレッジ・コンテキスト: ${profile.knowledge}` : ""}

## 元投稿（参考のみ、転載禁止）
${input.postText}

## 深掘りステップ
${stepsContext}

## ユーザーの最終メモ
${input.userFinalNote || "なし"}

## 最終サマリー
${input.finalSummary || "なし"}

## 出力形式: ${outputTypeLabel[input.outputType] || input.outputType}

以下のJSON形式で返してください：
{
  "title": "タイトル",
  "content": "本文内容",
  "contentJson": { /* 必要に応じた構造データ */ }
}

${input.outputType === "instagram" ? `
Instagramカルーセルの場合、contentJsonに以下を含めてください:
{
  "slides": [
    { "slideNumber": 1, "heading": "見出し", "body": "本文", "note": "補足" }
  ]
}
` : ""}

${input.outputType === "x" ? "X投稿は280文字以内に収めてください。ハッシュタグは2-3個にしてください。" : ""}

${input.outputType === "markdown_log" ? "Markdownの学習ログとして、見出し・箇条書き・コードブロック等を活用してください。" : ""}

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
- 抽象論だけでなく、実際に使える手順まで落とし込む

contentJsonに以下の構造で返してください:
{
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

スライドは15〜25枚程度で構成してください。` : ""}

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
