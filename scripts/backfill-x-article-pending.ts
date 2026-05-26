// Backfill script: mark existing posts containing X Article URLs as x_article_pending.
// Run (dry-run): pnpm exec tsx --env-file=.env scripts/backfill-x-article-pending.ts
// Run (apply):   pnpm exec tsx --env-file=.env scripts/backfill-x-article-pending.ts --apply

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { X_ARTICLE_RE } from "../src/lib/x/article";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);

const APPLY = process.argv.includes("--apply");
const URL_IN_TEXT_RE = /https?:\/\/\S+/g;

function hasXArticleUrl(urlCardJson: string | null, text: string): boolean {
  if (urlCardJson) {
    try {
      const card = JSON.parse(urlCardJson) as { expandedUrl?: string };
      if (card.expandedUrl && X_ARTICLE_RE.test(card.expandedUrl)) return true;
    } catch {}
  }
  for (const url of text.match(URL_IN_TEXT_RE) ?? []) {
    if (X_ARTICLE_RE.test(url)) return true;
  }
  return false;
}

async function main() {
  const posts = await prisma.post.findMany({
    where: { enrichmentStatus: { in: ["pending", "done"] } },
    select: { id: true, urlCardJson: true, text: true, enrichmentStatus: true },
  });

  const targets = posts.filter((p) => hasXArticleUrl(p.urlCardJson, p.text));

  console.log(`対象ポスト: ${targets.length} 件（"pending"/"done" から絞り込み）`);
  if (targets.length === 0) {
    console.log("マーク対象なし。終了。");
    return;
  }

  console.log("\nサンプル（最大5件）:");
  for (const p of targets.slice(0, 5)) {
    const preview = p.text.slice(0, 80).replace(/\n/g, " ");
    console.log(`  id=${p.id} status=${p.enrichmentStatus} text="${preview}"`);
  }

  if (!APPLY) {
    console.log(`\n[dry-run] ${targets.length} 件を x_article_pending にマークします。`);
    console.log("実際に更新するには --apply を付けて実行してください。");
    return;
  }

  console.log(`\n[apply] ${targets.length} 件を更新中...`);
  await prisma.post.updateMany({
    where: { id: { in: targets.map((p) => p.id) } },
    data: { enrichmentStatus: "x_article_pending" },
  });
  console.log("完了。");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect());
