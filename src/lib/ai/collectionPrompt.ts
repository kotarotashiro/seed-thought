import { getProfile } from "@/lib/profile/fixedProfile";

export type CollectionOutputKind = "seminar" | "mini_course" | "note" | "newsletter";

export interface CollectionCardInput {
  title: string;
  summary: string;
  coreInsight: string;
  manual: string;
  userMemo?: string | null;
  category?: string | null;
}

export interface CollectionPromptInput {
  collectionTitle: string;
  collectionDescription?: string | null;
  collectionIdea?: string | null;
  outputKind: CollectionOutputKind;
  cards: CollectionCardInput[];
}

const KIND_INSTRUCTION: Record<CollectionOutputKind, string> = {
  seminar:
    "受講者が90分で「使えるようになる」セミナーとして再構成してください。導入・各章・実演・ワーク・テンプレ・締めを含めること。",
  mini_course:
    "7日間のメール講座として再構成してください。各日は読了10分・ワーク5分で完結する内容にすること。",
  note:
    "note記事1本（2,500〜4,000文字）として、見出し・本文・引用・行動喚起を含む読み物に再構成してください。",
  newsletter:
    "週次ニュースレターとして再構成してください。今週の学び3つ・実践Tips・問いかけ・来週予告で構成すること。",
};

export async function buildCollectionPrompt(input: CollectionPromptInput): Promise<string> {
  const profile = await getProfile();
  const cardsContext = input.cards
    .map((card, i) => {
      const lines = [
        `### カード${i + 1}: ${card.title}`,
        card.category ? `カテゴリ: ${card.category}` : null,
        `要約: ${card.summary}`,
        `核心: ${card.coreInsight}`,
        `マニュアル: ${card.manual}`,
        card.userMemo ? `自分メモ: ${card.userMemo}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");

  const ideaSection = input.collectionIdea?.trim()
    ? `\n## 自分のアイディア・視点\n${input.collectionIdea.trim()}\n\nこのアイディアをカードの知見と組み合わせて、独自の視点・事例・問いかけを加えてください。`
    : "";

  return `あなたは複数の学習カードを束ねて、一本のコンテンツに再構成するエディターです。

## ユーザープロフィール
名前: ${profile.name}
役割: ${profile.role}
テーマ: ${profile.themes.join("、")}
トーン: ${profile.tone}${profile.knowledge ? `\nナレッジ・コンテキスト: ${profile.knowledge}` : ""}

## コレクション
タイトル: ${input.collectionTitle}
${input.collectionDescription ? `説明: ${input.collectionDescription}` : ""}
カード数: ${input.cards.length}
${ideaSection}
## 含まれる学習カード
${cardsContext}

## タスク
${KIND_INSTRUCTION[input.outputKind]}

## 出力ルール
- 各カードの内容を「並べる」だけにしないこと。共通テーマを見抜き、章立てを再構成すること。
- カードに無いことを勝手に作らないこと。元の知見を尊重しつつ、構造化・接続のみ行うこと。${input.collectionIdea?.trim() ? "\n- 「自分のアイディア・視点」が指定されている場合はそれを積極的に反映し、独自性を加えること。" : ""}
- 受け手が「最後に何ができるようになるか」を明示すること。
- 必要に応じて図解アイデア・実践ワーク・チェックリストを含めること。
- ${profile.role}の発信文脈に沿った言葉遣いにすること。

## 出力形式（必ず以下のJSONのみ。説明文不要）
{
  "title": "コンテンツのタイトル",
  "subtitle": "サブタイトル（任意）",
  "targetAudience": "誰のためのコンテンツか",
  "outcomes": ["受け手が得る成果1", "成果2", "成果3"],
  "outline": [
    { "section": "章タイトル", "summary": "この章の要旨", "fromCards": [1, 2], "keyPoints": ["要点1", "要点2"], "exercise": "実践ワーク（任意）" }
  ],
  "body": "実際の本文。${input.outputKind === "seminar" ? "台本ベース" : input.outputKind === "mini_course" ? "Day1〜Day7のメール文" : input.outputKind === "note" ? "note記事として完成された本文" : "週次配信の文章"}",
  "callToAction": "読了後の行動喚起",
  "credits": "元になったカードへの言及"
}

JSONのみ返してください。`;
}
