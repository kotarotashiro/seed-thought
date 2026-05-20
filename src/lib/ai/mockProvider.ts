import type {
  AiProvider,
  ChatMessage,
  ClassifyPostInput,
  PostClassificationResult,
  GenerateDeepDiveSessionInput,
  GeneratedDeepDiveSessionResult,
  GenerateOutputInput,
  GeneratedOutputResult,
  LearningOutput,
  PostContext,
  PostSummaryForSearch,
  PostSummaryForTrend,
  SemanticSearchResult,
  SourcePostForLearning,
  TranslateTextInput,
  TrendInsight,
} from "./types";

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
      tags: [primaryCategory, "深掘り対象"],
      summary: text.length > 50 ? text.substring(0, 50) + "..." : text,
      recommendReason: `${fixedProfileName}さんの${primaryCategory}テーマに関連が深く、深掘りすることで実践的な学びが得られます。`,
      difficultyLevel: "beginner",
      thinkingPotentialScore: isThought ? 85 : 50,
      learningPotentialScore: isLearning ? 90 : 55,
      outputPotentialScore: isOutput ? 88 : 60,
      recommendedMode: isThought ? "thought_lens" : "learning_lesson",
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

  async generateDeepDiveSession(input: GenerateDeepDiveSessionInput): Promise<GeneratedDeepDiveSessionResult> {
    await delay(800);

    if (input.mode === "thought_lens") {
      return {
        steps: [
          {
            stepIndex: 0,
            stepKey: "surface_claim",
            title: "表面的な主張",
            question: "この投稿は、表面的に何を主張していますか？",
            aiContent: {
              explanation: `この投稿は「${input.postText.substring(0, 30)}...」という主張をしています。一見シンプルに見えますが、ここには発信者の深い経験と洞察が込められています。まずは表面的な意味をしっかり把握しましょう。`,
              keyPoints: ["主張の核心を掴む", "言葉の選び方に注目", "誰に向けた言葉かを考える"],
              examples: ["「情報を削ることは価値を足すこと」→ 引き算の価値を主張"],
              promptForUser: "この投稿を一言で言い換えるとしたら？",
            },
          },
          {
            stepIndex: 1,
            stepKey: "hidden_premise",
            title: "背後にある前提",
            question: "この主張が成り立つために、暗黙的に前提としていることは何ですか？",
            aiContent: {
              explanation: "すべての主張には、明言されていない前提が存在します。この投稿が「正しい」と感じられるのは、ある特定の状況や価値観を前提としているからです。その前提を言語化することで、主張の適用範囲が見えてきます。",
              keyPoints: ["暗黙の前提を見つける", "前提が成り立つ条件を考える", "前提が崩れるケースを想像する"],
              examples: ["前提例：情報は多ければ良いという思い込みがある"],
              promptForUser: "この主張が「当然」と思える人は、どんな経験をしてきた人だと思いますか？",
            },
          },
          {
            stepIndex: 2,
            stepKey: "essence",
            title: "この投稿の本質",
            question: "この投稿が本当に伝えたいことの本質は何ですか？",
            aiContent: {
              explanation: "表面的な主張と背後の前提を踏まえた上で、この投稿の「本質」を抽出します。本質とは、具体的な文脈を取り除いても残る、普遍的なメッセージです。",
              keyPoints: ["具体から抽象への変換", "他の分野にも当てはまるか検証", "自分の経験と照合する"],
              examples: ["本質：取捨選択こそがクリエイティブの核心"],
              promptForUser: "この考え方は、あなたの仕事のどの場面で当てはまりますか？",
            },
          },
          {
            stepIndex: 3,
            stepKey: "counter_argument",
            title: "反論・成立条件",
            question: "この主張に対する反論や、成立しないケースはありますか？",
            aiContent: {
              explanation: "どんな優れた主張にも限界や例外があります。あえて反論の立場に立つことで、主張の強度と適用範囲がより明確になります。批判的に考えることは、否定ではなく、理解を深めるプロセスです。",
              keyPoints: ["反論を考えることは理解を深める", "成立条件を明確にする", "例外ケースを想像する"],
              examples: ["反論：初学者には情報量が必要な段階もある"],
              promptForUser: "この主張が「当てはまらない」場面を1つ挙げてみてください。",
            },
          },
          {
            stepIndex: 4,
            stepKey: "apply_to_work",
            title: "自分の仕事に置き換える",
            question: "この考え方を、あなたの日常業務やクリエイティブに置き換えるとどうなりますか？",
            aiContent: {
              explanation: `${fixedProfileName}さんは${fixedProfileRole}として活動しています。この投稿の本質を、Instagram運用やLINE導線設計、コンテンツ制作の文脈に置き換えてみましょう。抽象的な学びが、具体的な行動に変わる瞬間です。`,
              keyPoints: ["自分のテーマに変換する", "具体的なアクションを考える", "明日からできることを1つ見つける"],
              examples: ["Instagramの投稿作成時に、情報を削る勇気を持つ"],
              promptForUser: "明日の仕事で、この考え方を1つ試すとしたら何をしますか？",
            },
          },
          {
            stepIndex: 5,
            stepKey: "own_words",
            title: "自分の言葉でまとめる",
            question: "ここまでの深掘りを踏まえて、自分の言葉でこの学びをまとめてください。",
            aiContent: {
              explanation: "最後のステップです。これまでの5つのステップで考えたことを統合し、あなた自身の言葉でまとめましょう。他人の言葉を借りるのではなく、自分の経験・文脈・価値観を通して語ることで、初めて「自分の知識」になります。",
              keyPoints: ["自分の経験と紐づける", "発信に使える形にする", "具体的な行動宣言を含める"],
              examples: ["例：「情報を削ることは勇気がいるけど、読者の迷いを減らすことが本当の価値だと気づいた」"],
              promptForUser: "このメモは、そのまま発信の原稿にもなります。思い切って書いてみましょう。",
            },
          },
        ],
      };
    }

    // learning_lesson mode
    return {
      steps: [
        {
          stepIndex: 0,
          stepKey: "what_to_learn",
          title: "この投稿から学べること",
          question: "この投稿からどんな知識やスキルが学べそうですか？",
          aiContent: {
            explanation: `この投稿「${input.postText.substring(0, 30)}...」には、実践的な学びのエッセンスが含まれています。まずは「何が学べるか」を整理してから、一歩ずつ理解を深めていきましょう。`,
            keyPoints: ["学べるスキルの全体像", "実践での活用場面", "関連する基礎知識"],
            examples: ["スキル例：SNS投稿のCTR改善テクニック"],
            promptForUser: "この投稿を読んで、一番学びたいと思ったポイントは何ですか？",
          },
        },
        {
          stepIndex: 1,
          stepKey: "basics",
          title: "基礎知識",
          question: "この内容を理解するために必要な基礎知識は何ですか？",
          aiContent: {
            explanation: "この投稿の内容を正しく理解し、実践するためには、いくつかの前提知識が必要です。基礎をしっかり押さえることで、応用の幅が広がります。",
            keyPoints: ["関連する基本概念", "知っておくべき用語", "この分野の全体像"],
            examples: ["基礎例：エンゲージメント率の計算方法"],
            promptForUser: "この中で、初めて知った概念や用語はありますか？",
          },
        },
        {
          stepIndex: 2,
          stepKey: "mechanism",
          title: "仕組み",
          question: "なぜこの方法が効果的なのか、その仕組みを理解できますか？",
          aiContent: {
            explanation: "「何をするか」だけでなく「なぜ効くのか」を理解することが重要です。仕組みがわかれば、状況に応じたアレンジができるようになります。",
            keyPoints: ["効果が出る理由", "背景にあるメカニズム", "うまくいく条件"],
            examples: ["仕組み例：人は問いを投げかけられると無意識に答えを探し始める"],
            promptForUser: "この仕組みを、別の場面で見たことはありますか？",
          },
        },
        {
          stepIndex: 3,
          stepKey: "practical_steps",
          title: "実践手順",
          question: "実際にやるとしたら、どんな手順で進めますか？",
          aiContent: {
            explanation: "理論を実践に移すための具体的な手順を整理します。大きな目標を小さなステップに分解することで、行動のハードルが下がります。",
            keyPoints: ["ステップ1: 現状の分析", "ステップ2: 目標の設定", "ステップ3: 具体的なアクション", "ステップ4: 効果測定"],
            examples: ["手順例：① ターゲットを決める → ② 悩みを言語化 → ③ 投稿を作成 → ④ 反応を確認"],
            promptForUser: "この手順のうち、すぐにできそうなステップはどれですか？",
          },
        },
        {
          stepIndex: 4,
          stepKey: "examples",
          title: "具体例",
          question: "実際の具体例を見て、イメージを掴みましょう。",
          aiContent: {
            explanation: "抽象的な概念は、具体例を通じて理解が深まります。成功例だけでなく、失敗例も含めて見ることで、実践の精度が上がります。",
            keyPoints: ["成功パターンの共通点", "失敗パターンの原因", "自分の領域への適用"],
            examples: ["成功例：保存率8%を達成した投稿の構造分析", "失敗例：情報過多で保存されなかった投稿"],
            promptForUser: "あなたの過去の経験で、似たような成功・失敗はありましたか？",
          },
        },
        {
          stepIndex: 5,
          stepKey: "try_with_theme",
          title: "自分のテーマで試す",
          question: "学んだことを、自分のテーマやビジネスに当てはめてみましょう。",
          aiContent: {
            explanation: `${fixedProfileName}さんの${fixedProfileRole}というポジションで、この学びをどう活かせるか考えてみましょう。「知っている」と「使える」の間には、自分のテーマに変換するプロセスが必要です。`,
            keyPoints: ["自分のテーマへの変換", "今すぐ使えるアクション", "中長期的な活用計画"],
            examples: ["変換例：Instagram → LINE導線 → セミナー集客の流れに組み込む"],
            promptForUser: "来週中に試してみたいアクションを1つ書いてみてください。",
          },
        },
        {
          stepIndex: 6,
          stepKey: "comprehension_check",
          title: "理解チェック",
          question: "最後に、今回の学びの理解度を確認しましょう。",
          aiContent: {
            explanation: "理解度を確認するための簡単なチェックです。正解・不正解を気にする必要はありません。自分の理解を言語化すること自体が学習の仕上げです。",
            keyPoints: ["Q1: この投稿の核心的な学びを一文で表すと？", "Q2: この学びを実践する最初の一歩は？", "Q3: 3ヶ月後にどう活かしていたいですか？"],
            examples: ["回答例：「1枚目で悩みを言語化することが保存率向上の鍵」"],
            promptForUser: "上の3つの問いに、自分の言葉で答えてみてください。",
          },
        },
      ],
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
          content: `💡 ${context.substring(0, 100)}\n\n自分の仕事に置き換えて気づいたこと。\n大事なのは知識の量じゃなく、自分の言葉に変えられるかどうか。\n\n#${input.classification.primaryCategory} #深掘り学習`,
        };

      case "instagram":
        return {
          title: "Instagramカルーセル",
          content: `【${input.classification.primaryCategory}】深掘りから見えてきたこと\n\n${context.substring(0, 200)}`,
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
          title: `${input.classification.primaryCategory}の深掘りメモ`,
          content: `# ${input.classification.primaryCategory}について深掘りしてみた\n\n## きっかけ\nSNSで見かけた投稿を深掘りしてみました。\n\n## 学んだこと\n${context}\n\n## 自分の仕事での活かし方\n${input.userFinalNote || "（まだ整理中）"}\n\n## まとめ\n知識は、自分の言葉に変えた瞬間に使えるものになる。\n\n---\nSeedThoughtで深掘り学習しました。`,
        };

      case "markdown_log":
        return {
          title: "学習ログ",
          content: `# 学習ログ: ${input.classification.primaryCategory}\n\n## 日時\n${new Date().toLocaleDateString("ja-JP")}\n\n## 元投稿の要点\n${input.classification.summary}\n\n## 深掘りステップ\n${input.steps.map((s, i) => `### ${i + 1}. ${s.title}\n- 問い: ${s.question}\n- メモ: ${s.userNote || "なし"}`).join("\n\n")}\n\n## 自分の言葉まとめ\n${input.userFinalNote || "（未記入）"}\n\n## 次のアクション\n- [ ] 学んだことを1つ実践する\n- [ ] 1週間後に振り返る`,
        };

      default:
        return { title: "出力", content: context };
    }
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
const fixedProfileRole = "AI活用・SNS運用・LINE導線設計を発信する個人クリエイター";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
