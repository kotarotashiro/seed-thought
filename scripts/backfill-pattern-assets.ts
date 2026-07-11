import "dotenv/config";
import { promotePatternAsset } from "../src/lib/assets/promotePattern";
import { prisma } from "../src/lib/db/prisma";
import type { LearningOutput } from "../src/lib/ai/types";

async function main() {
  const cards = await prisma.learningCard.findMany({
    select: { id: true, outputJson: true },
    orderBy: { createdAt: "asc" },
  });

  let promoted = 0;
  let skipped = 0;

  for (const card of cards) {
    let output: LearningOutput | null = null;
    try {
      output = JSON.parse(card.outputJson) as LearningOutput;
    } catch {
      skipped += 1;
      continue;
    }

    if (!output.decode?.extractedPattern) continue;
    await promotePatternAsset(card.id, output.decode);
    promoted += 1;
  }

  console.log(`対象カード数: ${cards.length}`);
  console.log(`昇格した件数: ${promoted}`);
  console.log(`skip数: ${skipped}`);
}

main()
  .catch((error) => {
    console.error("PatternAsset backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
