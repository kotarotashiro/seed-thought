import { getProfile } from "@/lib/profile/fixedProfile";
import type { ClassifyPostInput, GenerateDeepDiveSessionInput, GenerateOutputInput } from "./types";

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
  "summary": "投稿の要約（50文字程度）",
  "recommendReason": "なぜこの投稿を深掘りすべきか（80文字程度）",
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

  return `あなたは深掘り学習のファシリテーターです。

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

## モード: ${input.mode === "thought_lens" ? "思考レンズ" : "学習レッスン"}

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
        "explanation": "AIの解説（200-400文字）",
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
