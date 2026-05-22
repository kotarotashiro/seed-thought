import type {
  AiProvider,
  ChatMessage,
  ClassifyPostInput,
  PostClassificationResult,
  GenerateOutputInput,
  GeneratedOutputResult,
  LearningOutput,
  PostContext,
  PostSummaryForSearch,
  PostSummaryForTrend,
  SemanticSearchResult,
  SourcePostForLearning,
  StrictLearningOutput,
  TranslateTextInput,
  TrendInsight,
} from "./types";
import { createFallbackStrictLearning } from "./fallback";

/**
 * Mock AI Provider - returns deterministic results for development
 */
export const mockProvider: AiProvider = {
  async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
    await delay(500);

    const text = input.text;
    const isThought = text.includes("考え") || text.includes("本質") || text.includes("価値") || text.includes("問い") || text.includes("削る") || text.includes("選択");
    const isLearning = text.includes("方法") || text.includes("手順") || text.includes("使い方") || text.includes("率") || text.includes("設計") || text.includes("集客") || text.includes("生成");
    const isOutput = text.includes("テンプレ") || text.includes("チラシ") || text.includes("導線") || text.includes("発信");

    let postType: PostClassificationResult["postType"] = "unknown";
    if (isThought) postType = "thought";
    else if (isLearning) postType = "learning";
    else if (isOutput) postType = "output_material";

    const categories = ["AI活用", "SNS運用", "マーケティング", "コンテンツ制作", "LINE運用"];
    const primaryCategory = categories[Math.floor(Math.random() * categories.length)];

    return {
      postType,
      primaryCategory,
      tags: [primaryCategory, "学習候補"],
      summary: text.length > 50 ? text.substring(0, 50) + "..." : text,
      recommendReason: `${fixedProfileName}さんの${primaryCategory}テーマに関連が深く、学習カード化することで実践的な学びが得られます。`,
      difficultyLevel: "beginner",
      thinkingPotentialScore: isThought ? 85 : 50,
      learningPotentialScore: isLearning ? 90 : 55,
      outputPotentialScore: isOutput ? 88 : 60,
      recommendedMode: "unknown",
    };
  },

  async translateText(input: TranslateTextInput): Promise<string> {
    return input.text;
  },

  async generateLearningCard(input: SourcePostForLearning): Promise<LearningOutput> {
    await delay(800);

    const baseText = input.translatedText || input.text;
    const topic = input.genre || input.type || "保存投稿のノウハウ";
    const title = `${topic}を実務で使うための学習カード`;

    return {
      sourcePostId: input.id,
      title,
      summary: `この投稿は、${topic}に関する気づきを扱っています。\nポイントは、内容をそのまま読むのではなく、再利用できる型として捉えることです。\n実務では手順化して小さく試すことで価値に変えられます。`,
      originalIntent: "投稿者は、自分の経験から得た実践知を短い形で共有し、読者が次の行動に移せるようにしています。",
      whatIsInteresting: "短い投稿の中に、背景となる判断基準、実践手順、応用できる型が含まれている点が面白いところです。",
      coreInsight: `${baseText.substring(0, 80)}${baseText.length > 80 ? "..." : ""} という内容を、自分の仕事に移植できる構造として捉えることが中心です。`,
      structure: [
        { label: "課題の発見", description: "投稿内で扱われている困りごとや改善余地を見つける。" },
        { label: "型への変換", description: "個別の経験を、他の場面でも使える手順や判断基準に変える。" },
        { label: "実務への適用", description: "自分のテーマや顧客対応、発信、教材づくりに置き換える。" },
      ],
      steps: [
        {
          title: "投稿の狙いを一文にする",
          description: "投稿者が一番伝えたいことを、自分の言葉で短く言い換えます。",
          actions: ["本文と翻訳を読み比べる", "重要そうな動詞を抜き出す", "一文の学びにする"],
        },
        {
          title: "再利用できる手順に分ける",
          description: "ノウハウとして実行できるように、順番と条件を整理します。",
          actions: ["前提条件を書く", "実行手順を3から5個に分ける", "失敗しやすい点をメモする"],
        },
        {
          title: "自分の業務に置き換える",
          description: "自分の発信、提案、教材、作業フローにどう使うかを決めます。",
          actions: ["使う場面を1つ選ぶ", "明日試す小さな行動にする", "結果を見る指標を決める"],
        },
      ],
      manual: `# ${title}\n\n## 目的\n保存した投稿から、実務に使えるノウハウを取り出す。\n\n## 進め方\n1. 投稿の中心メッセージを一文にする。\n2. そのメッセージを、判断基準・手順・注意点に分ける。\n3. 自分の仕事で使う場面を1つ決める。\n4. 小さく試し、結果をメモする。\n\n## 使いどころ\n発信内容の設計、セミナー資料、業務マニュアル、顧客への説明資料に転用できます。`,
      applicationIdeas: [
        { title: "発信用コンテンツ", description: "投稿の構造をもとに、自分のテーマの解説投稿へ変換する。" },
        { title: "業務マニュアル", description: "実践手順をチェックリスト化し、繰り返し使える作業メモにする。" },
        { title: "教材づくり", description: "図解構成を使って、セミナーやワークショップの説明資料にする。" },
      ],
      tips: ["投稿の文面を転載せず、自分の言葉に置き換える", "最初は1つの業務場面だけで試す", "うまくいった条件も一緒に保存する"],
      useCases: ["学習メモ", "SNS投稿", "セミナー資料", "業務手順書", "ノウハウ記事"],
      diagramStructure: {
        title: `${topic}を使える知識に変える流れ`,
        sections: [
          { heading: "投稿の核", body: "一番大事な主張を短く整理する", visualIdea: "中央にキーメッセージを置く" },
          { heading: "構造化", body: "背景、手順、注意点に分ける", visualIdea: "3分割のフロー図" },
          { heading: "応用", body: "自分の業務や発信に置き換える", visualIdea: "矢印で実務活用へつなぐ" },
        ],
      },
      imageExplanationPrompt: `日本語の学習用図解。タイトルは「${topic}を使える知識に変える流れ」。中央に投稿の核、左から右に「抽出」「構造化」「実務へ応用」の3ステップを配置。落ち着いた白背景、アクセントカラーは緑、セミナー資料に使える読みやすいデザイン。`,
      userLearningMemo: "この投稿は、保存して終わりにせず、自分の実務で試せる小さな手順に変えると価値が出る。",
      status: "draft",
    };
  },

  async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
    await delay(600);

    const userNotes = input.steps
      .filter((s) => s.userNote)
      .map((s) => s.userNote)
      .join("\n");

    const context = userNotes || input.finalSummary || input.postText.substring(0, 100);

    switch (input.outputType) {
      case "x":
        return {
          title: "X投稿",
          content: `💡 ${context.substring(0, 100)}\n\n自分の仕事に置き換えて気づいたこと。\n大事なのは知識の量じゃなく、自分の言葉に変えられるかどうか。\n\n#${input.classification.primaryCategory} #学び`,
        };

      case "instagram":
        return {
          title: "Instagramカルーセル",
          content: `【${input.classification.primaryCategory}】学習カードから見えてきたこと\n\n${context.substring(0, 200)}`,
          contentJson: {
            slides: [
              { slideNumber: 1, heading: "気づきをシェア", body: context.substring(0, 80), note: "1枚目で興味を引く" },
              { slideNumber: 2, heading: "なぜ大事なのか", body: "この考え方が実践で使える理由", note: "背景を説明" },
              { slideNumber: 3, heading: "具体的なアクション", body: "明日から試せること", note: "行動を促す" },
              { slideNumber: 4, heading: "まとめ", body: "一番大事なポイント", note: "保存を促す" },
            ],
          },
        };

      case "note":
        return {
          title: `${input.classification.primaryCategory}の学習メモ`,
          content: `# ${input.classification.primaryCategory}について整理した\n\n## きっかけ\nSNSで見かけた投稿を学習カードにしました。\n\n## 学んだこと\n${context}\n\n## 自分の仕事での活かし方\n${input.userFinalNote || "（まだ整理中）"}\n\n## まとめ\n知識は、自分の言葉に変えた瞬間に使えるものになる。\n\n---\nSeedThoughtで学習しました。`,
        };

      case "markdown_log":
        return {
          title: "学習ログ",
          content: `# 学習ログ: ${input.classification.primaryCategory}\n\n## 日時\n${new Date().toLocaleDateString("ja-JP")}\n\n## 元投稿の要点\n${input.classification.summary}\n\n## 学習カードまとめ\n${context}\n\n## 自分の言葉まとめ\n${input.userFinalNote || "（未記入）"}\n\n## 次のアクション\n- [ ] 学んだことを1つ実践する\n- [ ] 1週間後に振り返る`,
        };

      case "strict_learning": {
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

      default:
        return { title: "出力", content: context };
    }
  },

  async generateStrictLearning(input: {
    postText: string;
    classification: { primaryCategory: string; summary: string };
    learningCardJson?: string;
    userMemo?: string | null;
  }): Promise<StrictLearningOutput> {
    await delay(600);
    return createFallbackStrictLearning({
      postText: input.postText,
      classification: {
        postType: "learning",
        primaryCategory: input.classification.primaryCategory,
        tags: [],
        summary: input.classification.summary,
        recommendReason: "",
        difficultyLevel: "beginner",
        thinkingPotentialScore: 70,
        learningPotentialScore: 85,
        outputPotentialScore: 60,
        recommendedMode: "unknown",
      },
    });
  },

  async searchSemantically(_query: string, posts: PostSummaryForSearch[]): Promise<SemanticSearchResult> {
    await delay(400);
    return {
      results: posts.slice(0, 3).map((p, i) => ({
        postId: p.id,
        relevanceScore: 90 - i * 10,
        reason: `${p.primaryCategory}に関連するノウハウです`,
      })),
    };
  },

  async analyzeLikeTrends(_posts: PostSummaryForTrend[]): Promise<TrendInsight> {
    await delay(600);
    return {
      topCategories: ["AI活用", "SNS運用", "コンテンツ制作"],
      favoriteThemes: ["発信力", "効率化", "学習法"],
      learningStyle: "実践的なノウハウより抽象的な思考系コンテンツを好む傾向があります",
      strengths: ["情報収集力", "パターン認識", "発信力"],
      recommendedNextTopics: ["動画コンテンツ制作", "コミュニティ運営", "ライティング"],
      summary: "AI・SNS・学習系のコンテンツを多く保存しており、実践的なスキルアップへの関心が高いです",
    };
  },

  async chat(_message: string, _history: ChatMessage[], posts: PostContext[]): Promise<string> {
    await delay(700);
    const postCount = posts.length;
    return `${postCount}件の保存投稿を参照して回答します。\n\nこれはモックレスポンスです。実際のAIプロバイダーを設定すると、保存した投稿の内容をもとに詳しく回答します。`;
  },
};

const fixedProfileName = "そら";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
