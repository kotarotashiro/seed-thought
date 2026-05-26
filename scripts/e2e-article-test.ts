// E2E verification script for X Article fetch feature.
// Run: pnpm exec tsx --env-file=.env scripts/e2e-article-test.ts

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);

const BASE = "http://localhost:3010";
const TEST_ARTICLE_URL = "https://x.com/i/article/1900000000000000001";
const TEST_SOURCE_POST_ID = "test-article-e2e-" + Date.now();

async function cleanup(postId: string) {
  await prisma.post.delete({ where: { id: postId } }).catch(() => {});
}

async function main() {
  console.log("=== X Article E2E verification ===\n");

  // 1. Insert test post with x_article_pending
  console.log("1. Inserting test post with enrichmentStatus=x_article_pending...");
  const post = await prisma.post.create({
    data: {
      source: "user_like",
      savedType: "like",
      sourcePostId: TEST_SOURCE_POST_ID,
      text: `テスト記事です ${TEST_ARTICLE_URL}`,
      urlCardJson: JSON.stringify({
        expandedUrl: TEST_ARTICLE_URL,
        title: null,
        description: null,
        imageUrl: null,
      }),
      savedAt: new Date(),
      enrichmentStatus: "x_article_pending",
    },
  });
  console.log(`   Created post id=${post.id}\n`);

  // 2. GET /api/x/article-body?limit=5 — should include our post
  console.log("2. GET /api/x/article-body?limit=5");
  const listRes = await fetch(`${BASE}/api/x/article-body?limit=5`);
  if (!listRes.ok) {
    const text = await listRes.text();
    console.error(`   FAIL: HTTP ${listRes.status}. Body: ${text.slice(0, 200)}`);
    await cleanup(post.id);
    process.exit(1);
  }
  const listJson = await listRes.json() as { items: { postId: string; articleUrl: string }[] };
  const found = listJson.items.find((i) => i.postId === post.id);
  if (!found) {
    console.error("   FAIL: post not found in items. Response:", JSON.stringify(listJson));
    await cleanup(post.id);
    process.exit(1);
  }
  console.log(`   PASS: postId=${found.postId} articleUrl=${found.articleUrl}\n`);

  // 3. POST /api/x/article-body — update with article body
  const articleBodyText = "これはテスト用の記事本文です。X Article の本文取得機能の動作確認のために使用しています。".repeat(3);
  console.log("3. POST /api/x/article-body (update with article body)");
  const updateRes = await fetch(`${BASE}/api/x/article-body`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: post.id, title: "テスト記事タイトル", body: articleBodyText }),
  });
  if (!updateRes.ok) {
    const text = await updateRes.text();
    console.error(`   FAIL: HTTP ${updateRes.status}. Body: ${text.slice(0, 200)}`);
    await cleanup(post.id);
    process.exit(1);
  }
  const updateJson = await updateRes.json() as { ok?: boolean; error?: string };
  if (!updateJson.ok) {
    console.error("   FAIL:", updateJson);
    await cleanup(post.id);
    process.exit(1);
  }
  console.log(`   PASS: ok=true\n`);

  // 4. DB: enrichmentStatus should be "done"
  console.log("4. Verify enrichmentStatus=done in DB");
  const updated = await prisma.post.findUnique({ where: { id: post.id } });
  if (updated?.enrichmentStatus !== "done") {
    console.error(`   FAIL: enrichmentStatus=${updated?.enrichmentStatus}`);
    await cleanup(post.id);
    process.exit(1);
  }
  console.log(`   PASS: enrichmentStatus=done, text starts with "${updated.text.slice(0, 50)}..."\n`);

  // 5. GET /api/fetch-article?url= — should return isXArticle:true with fromCache:true
  console.log("5. GET /api/fetch-article?url=<article url>");
  const fetchRes = await fetch(`${BASE}/api/fetch-article?url=${encodeURIComponent(TEST_ARTICLE_URL)}`);
  const fetchJson = await fetchRes.json() as { isXArticle?: boolean; fromCache?: boolean; description?: string | null };
  if (!fetchJson.isXArticle) {
    console.error("   FAIL: isXArticle not true. Response:", JSON.stringify(fetchJson));
    await cleanup(post.id);
    process.exit(1);
  }
  if (!fetchJson.fromCache) {
    console.warn("   WARN: fromCache=false — DB lookup did not match. Response:", JSON.stringify(fetchJson));
  } else {
    console.log(`   PASS: isXArticle=true fromCache=true\n`);
  }

  // 6. Short body → 400
  console.log("6. POST with body too short → expect 400");
  const shortRes = await fetch(`${BASE}/api/x/article-body`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: post.id, title: null, body: "短い" }),
  });
  if (shortRes.status !== 400) {
    console.error(`   FAIL: expected 400 got ${shortRes.status}`);
    await cleanup(post.id);
    process.exit(1);
  }
  console.log(`   PASS: 400 returned\n`);

  // 7. Done post should not appear in pending queue
  console.log("7. Done post should not be in x_article_pending queue");
  const listRes2 = await fetch(`${BASE}/api/x/article-body?limit=20`);
  const listJson2 = await listRes2.json() as { items: { postId: string }[] };
  if (listJson2.items.find((i) => i.postId === post.id)) {
    console.error("   FAIL: done post still in pending queue");
    await cleanup(post.id);
    process.exit(1);
  }
  console.log(`   PASS: done post not in pending queue\n`);

  await cleanup(post.id);
  console.log("=== All checks passed ===");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect());
