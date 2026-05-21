import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

const seedPosts = [
  {
    text: "情報を削ることは、価値を足すこと。",
    authorName: "佐藤 一郎",
    authorUsername: "sato_ichiro",
    savedType: "like" as const,
    source: "x" as const,
    classification: {
      postType: "thought",
      primaryCategory: "コンテンツ制作",
      tags: ["情報設計", "ミニマリズム", "編集力"],
      summary: "情報を引き算する行為こそが、受け手にとっての価値を高めるという視点の投稿。",
      recommendReason: "Instagram投稿やチラシ制作において、情報の取捨選択は重要な課題。日々の発信に直結する考え方。",
      difficultyLevel: "beginner",
      thinkingPotentialScore: 90,
      learningPotentialScore: 40,
      outputPotentialScore: 75,
      recommendedMode: "thought_lens",
    },
  },
  {
    text: "Instagramの保存率を上げるには、1枚目で悩みを言語化して、『それ、私のことだ』と思わせることが大事。",
    authorName: "田中 花子",
    authorUsername: "tanaka_hanako",
    savedType: "bookmark" as const,
    source: "x" as const,
    classification: {
      postType: "learning",
      primaryCategory: "SNS運用",
      tags: ["Instagram", "保存率", "カルーセル"],
      summary: "Instagramの保存率を上げるには、1枚目で悩みを言語化することが重要だという投稿。",
      recommendReason: "Instagram投稿作成にすぐ活かせるノウハウ。保存率改善の具体策がある。",
      difficultyLevel: "beginner",
      thinkingPotentialScore: 30,
      learningPotentialScore: 92,
      outputPotentialScore: 88,
      recommendedMode: "learning_lesson",
    },
  },
  {
    text: "LINE公式アカウントで成果が出ない人は、リッチメニューを作る前に導線設計を見直すべき。",
    authorName: "鈴木 太郎",
    authorUsername: "suzuki_taro",
    savedType: "like" as const,
    source: "x" as const,
    classification: {
      postType: "learning",
      primaryCategory: "LINE運用",
      tags: ["公式LINE", "導線設計", "リッチメニュー"],
      summary: "LINE公式の成果はリッチメニューより導線設計が重要という指摘。",
      recommendReason: "LINE導線設計の根本的な考え方を学べる。クライアント支援にも活かせる。",
      difficultyLevel: "intermediate",
      thinkingPotentialScore: 50,
      learningPotentialScore: 85,
      outputPotentialScore: 70,
      recommendedMode: "learning_lesson",
    },
  },
  {
    text: "AIでチラシを作るなら、まず目的・ターゲット・CTAを決める。",
    authorName: "山田 美穂",
    authorUsername: "yamada_miho",
    savedType: "bookmark" as const,
    source: "x" as const,
    classification: {
      postType: "output_material",
      primaryCategory: "AI活用",
      tags: ["AI", "チラシ", "CTA", "デザイン"],
      summary: "AI活用チラシ制作の3つの前提条件を端的にまとめた投稿。",
      recommendReason: "AIチラシ制作のフレームワークとして発信ネタになる。そのまま実践手順に展開可能。",
      difficultyLevel: "beginner",
      thinkingPotentialScore: 35,
      learningPotentialScore: 70,
      outputPotentialScore: 92,
      recommendedMode: "learning_lesson",
    },
  },
  {
    text: "良い発信は、情報量ではなく、相手の中に残る問いを作れるかどうか。",
    authorName: "高橋 誠",
    authorUsername: "takahashi_makoto",
    savedType: "like" as const,
    source: "x" as const,
    classification: {
      postType: "thought",
      primaryCategory: "マーケティング",
      tags: ["発信力", "コピーライティング", "本質"],
      summary: "情報量より問いの質が重要という発信の本質論。",
      recommendReason: "X・Instagram・noteすべての発信に通じる本質的な視点。深掘りする価値が高い。",
      difficultyLevel: "intermediate",
      thinkingPotentialScore: 95,
      learningPotentialScore: 30,
      outputPotentialScore: 80,
      recommendedMode: "thought_lens",
    },
  },
  {
    text: "セミナー集客では、内容より先に『誰のどんな悩みを解決するか』を言語化する。",
    authorName: "中村 京子",
    authorUsername: "nakamura_kyoko",
    savedType: "bookmark" as const,
    source: "x" as const,
    classification: {
      postType: "learning",
      primaryCategory: "セミナー集客",
      tags: ["セミナー", "集客", "ターゲティング"],
      summary: "セミナー集客の第一歩はターゲットの悩みの言語化だという実践ノウハウ。",
      recommendReason: "セミナー企画時にすぐ使えるフレームワーク。クライアント支援の型にもなる。",
      difficultyLevel: "beginner",
      thinkingPotentialScore: 40,
      learningPotentialScore: 88,
      outputPotentialScore: 75,
      recommendedMode: "learning_lesson",
    },
  },
  {
    text: "選択肢を増やすことが親切とは限らない。迷いを減らすことも価値になる。",
    authorName: "伊藤 健一",
    authorUsername: "ito_kenichi",
    savedType: "like" as const,
    source: "x" as const,
    classification: {
      postType: "thought",
      primaryCategory: "マーケティング",
      tags: ["UX", "選択設計", "ミニマリズム"],
      summary: "選択肢を減らすことが顧客体験を向上させるという逆説的な視点。",
      recommendReason: "LP設計やサービス設計に応用できる。本質的なUXの考え方を学べる。",
      difficultyLevel: "intermediate",
      thinkingPotentialScore: 88,
      learningPotentialScore: 45,
      outputPotentialScore: 70,
      recommendedMode: "thought_lens",
    },
  },
  {
    text: "ChatGPTで画像生成するときは、世界観・構図・文字量・視線誘導を先に決める。",
    authorName: "小林 あかり",
    authorUsername: "kobayashi_akari",
    savedType: "bookmark" as const,
    source: "x" as const,
    classification: {
      postType: "learning",
      primaryCategory: "AI活用",
      tags: ["ChatGPT", "画像生成", "プロンプト設計"],
      summary: "AI画像生成の品質を上げる4つの事前設計ポイント。",
      recommendReason: "AI画像生成をすぐ実践に活かせる具体的な手順。Instagram投稿やチラシ制作にも応用可能。",
      difficultyLevel: "beginner",
      thinkingPotentialScore: 25,
      learningPotentialScore: 90,
      outputPotentialScore: 85,
      recommendedMode: "learning_lesson",
    },
  },
  {
    text: "小さなお店こそ、LINEとInstagramを別々に考えず、1つの導線として設計した方がいい。",
    authorName: "渡辺 大輔",
    authorUsername: "watanabe_daisuke",
    savedType: "like" as const,
    source: "x" as const,
    classification: {
      postType: "output_material",
      primaryCategory: "マーケティング",
      tags: ["LINE", "Instagram", "導線設計", "小規模ビジネス"],
      summary: "小規模ビジネスにおけるLINEとInstagramの統合導線設計の重要性を説いた投稿。",
      recommendReason: "クライアント向けの提案や発信ネタとして直接使える実践的な視点。",
      difficultyLevel: "beginner",
      thinkingPotentialScore: 55,
      learningPotentialScore: 70,
      outputPotentialScore: 90,
      recommendedMode: "learning_lesson",
    },
  },
  {
    text: "保存した情報は、見返した瞬間ではなく、自分の言葉に変えた瞬間に知識になる。",
    authorName: "松本 理沙",
    authorUsername: "matsumoto_risa",
    savedType: "bookmark" as const,
    source: "x" as const,
    classification: {
      postType: "thought",
      primaryCategory: "コンテンツ制作",
      tags: ["学習法", "アウトプット", "知識変換"],
      summary: "保存＝学習ではなく、自分の言葉への変換が学習だという本質的な指摘。",
      recommendReason: "SeedThoughtのコンセプトそのもの。自分の言葉で語れるようになるための原点。",
      difficultyLevel: "beginner",
      thinkingPotentialScore: 92,
      learningPotentialScore: 35,
      outputPotentialScore: 80,
      recommendedMode: "thought_lens",
    },
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.learningCardOutput.deleteMany();
  await prisma.learningCard.deleteMany();
  await prisma.postClassification.deleteMany();
  await prisma.xSyncRun.deleteMany();
  await prisma.xAccount.deleteMany();
  await prisma.post.deleteMany();

  for (const seedPost of seedPosts) {
    const post = await prisma.post.create({
      data: {
        source: seedPost.source,
        savedType: seedPost.savedType,
        text: seedPost.text,
        authorName: seedPost.authorName,
        authorUsername: seedPost.authorUsername,
        savedAt: new Date(
          Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000
        ),
      },
    });

    await prisma.postClassification.create({
      data: {
        postId: post.id,
        postType: seedPost.classification.postType,
        primaryCategory: seedPost.classification.primaryCategory,
        tagsJson: JSON.stringify(seedPost.classification.tags),
        summary: seedPost.classification.summary,
        recommendReason: seedPost.classification.recommendReason,
        difficultyLevel: seedPost.classification.difficultyLevel,
        thinkingPotentialScore: seedPost.classification.thinkingPotentialScore,
        learningPotentialScore: seedPost.classification.learningPotentialScore,
        outputPotentialScore: seedPost.classification.outputPotentialScore,
        recommendedMode: seedPost.classification.recommendedMode,
      },
    });

    console.log(`  ✅ Created: ${seedPost.text.substring(0, 40)}...`);
  }

  console.log(`\n🎉 Seeded ${seedPosts.length} posts with classifications.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
