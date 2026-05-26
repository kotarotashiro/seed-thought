import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as never);
  try {
    const deleted = await prisma.post.deleteMany({
      where: { sourcePostId: { startsWith: "test-article-e2e-" } },
    });
    console.log(`Deleted ${deleted.count} orphaned test posts`);
  } finally {
    await (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect();
  }
}

main().catch(console.error);
