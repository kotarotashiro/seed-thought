import { getProfile } from "@/lib/profile/fixedProfile";
import type { ChatMessage, ClassifyPostInput, GenerateDeepDiveSessionInput, GenerateOutputInput, PostContext, PostSummaryForSearch, PostSummaryForTrend, TranslateTextInput } from "./types";
import { beginnerTeachingRules, strictLearningKnowledge } from "./knowledge";

export async function buildClassifyPrompt(input: ClassifyPostInput): Promise<string> {
  const profile = await getProfile();
  return `あなたはSNS投稿の分類エキスパートです。

以下の投稿を分析し、JSON形式で返してください。

## ユーザープロフィール
名前: ${profile.name}
役割: ${profile.role}
テーマ: ${profile.themes.join("、")}
出力チャンネル: ${profile.outputChannels.join("、")}
トーン: ${profile.tone}

## 投稿本文
${input.text}

${input.authorName ? `投稿者: ${input.authorName}` : ""}
${input.authorUsername ? `アカウント: @${input.authorUsername}` : ""}

## 出力形式（必ず以下のJSONのみ返してください）
{
  "postType": "thought" | "learning" | "output_material" | "unknown",
  "primaryCategory": "カテゴリ名",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "summary": "投稿の要点を40-60文字で簡潔に要約。ツール名・技術名（Claude, ChatGPT, Cursor等）は省略せず記載。「●●を使って○○する方法」「●●で○○が可能」のような具体的・実用的な一文にする。抽象的な表現は避ける",
  "recommendReason": "ユーザーのプロフィールに照らして、なぜ深掘りする価値があるか（80-120文字）",
  "difficultyLevel": "beginner" | "intermediate" | "advanced" | "unknown",
  "thinkingPotentialScore": 0-100,
  "learningPotentialScore": 0-100,
  "outputPotentialScore": 0-100,
  "recommendedMode": "thought_lens" | "learning_lesson" | "unknown"
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

export async function buildDeepDivePrompt(input: GenerateDeepDiveSessionInput): Promise<string> {
  const profile = await getProfile();
  const modeSteps = input.mode === "thought_lens"
    ? [
        { key: "surface_claim", title: "表面的な主張" },
        { key: "hidden_premise", title: "背後にある前提" },
        { key: "essence", title: "この投稿の本質" },
        { key: "counter_argument", title: "反論・成立条件" },
        { key: "apply_to_work", title: "自分の仕事に置き換える" },
        { key: "own_words", title: "自分の言葉でまとめる" },
      ]
    : [
        { key: "what_to_learn", title: "この投稿から学べること" },
        { key: "basics", title: "基礎知識" },
        { key: "mechanism", title: "仕組み" },
        { key: "practical_steps", title: "実践手順" },
        { key: "examples", title: "具体例" },
        { key: "try_with_theme", title: "自分のテーマで試す" },
        { key: "comprehension_check", title: "理解チェック" },
      ];

  const stepsDescription = modeSteps.map((s, i) => `${i + 1}. ${s.key}: ${s.title}`).join("\n");

  return `あなたはSeedThoughtの専属学習コーチです。

## ユーザープロフィール
名前: ${profile.name}
役割: ${profile.role}
テーマ: ${profile.themes.join("、")}
トーン: ${profile.tone}

## 元投稿
${input.postText}

## 投稿分類
タイプ: ${input.classification.postType}
カテゴリ: ${input.classification.primaryCategory}
要約: ${input.classification.summary}

## モード: ${input.mode === "thought_lens" ? "思考レンズ" : "厳密学習レッスン"}

## 重要方針
${input.mode === "learning_lesson" ? `- あなたは塾の先生、ユーザーは生徒です。
- ユーザーに考えさせる前に、元投稿を教材として「何を学ぶべきか」「背景知識」「仕組み」「具体例」「実務での使い方」をあなたが具体的に教えてください。
- 各ステップのexplanationは、投稿本文の内容に必ず触れ、抽象論だけで終わらせないでください。
- questionは宿題ではなく、理解確認の短い問いにしてください。
- keyPointsとexamplesは、投稿固有の内容に合わせてください。
- 正例・反例・境界事例・必要条件・典型特徴を、難しい言葉にせず必ず説明に含めてください。
- 「初心者が最初に誤解しそうな点」を明示して、やさしく修正してください。

${beginnerTeachingRules}

${strictLearningKnowledge}` : `- 投稿の主張、前提、本質、反論、自分への応用を順に分解してください。
- 投稿固有の言葉や文脈を使い、汎用的な自己啓発文にしないでください。`}

## ステップ
${stepsDescription}

以下のJSON形式で、全ステップ分の内容を一括生成してください。

{
  "steps": [
    {
      "stepIndex": 0,
      "stepKey": "ステップキー",
      "title": "ステップタイトル",
      "question": "ユーザーへの問いかけ（80文字程度）",
      "aiContent": {
        "explanation": "${input.mode === "learning_lesson" ? "先生としての解説（500-900文字。投稿固有の内容、背景、具体例を含める）" : "AIの解説（250-500文字。投稿固有の内容に触れる）"}",
        "keyPoints": ["ポイント1", "ポイント2", "ポイント3"],
        "examples": ["具体例1", "具体例2"],
        "promptForUser": "ユーザーが考えるためのヒント（50文字程度）"
      }
    }
  ]
}

各ステップは前のステップの上に積み上がる構造にしてください。
最後のステップでは、ユーザーが自分の言葉でまとめられるよう促してください。
JSONのみ返してください。`;
}

export async function buildOutputPrompt(input: GenerateOutputInput): Promise<string> {
  const profile = await getProfile();
  const stepsContext = input.steps
    .map((s, i) => `### ステップ${i + 1}: ${s.title}\n問い: ${s.question}\nAI解説: ${s.aiContent}\nユーザーメモ: ${s.userNote || "なし"}`)
    .join("\n\n");

  const outputTypeLabel: Record<string, string> = {
    x: "X投稿（280文字以内）",
    instagram: "Instagramカルーセル（スライド構成）",
    note: "note記事（1000-2000文字）",
    markdown_log: "Markdown学習ログ",
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
トーン: ${profile.tone}

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
  history: import("./types").ChatMessage[],
  posts: import("./types").PostContext[]
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
