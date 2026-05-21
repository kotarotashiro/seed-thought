import { prisma } from "@/lib/db/prisma";

export type SelectionMode = "latest" | "random" | "genre" | "undigested";

export async function selectRecommendations(
  mode: SelectionMode,
  genre?: string,
  savedType?: string
) {
  const count = 3;
  const savedTypeWhere = savedType ? { savedType } : {};

  switch (mode) {
    case "latest": {
      const posts = await prisma.post.findMany({
        where: savedTypeWhere,
        orderBy: { savedAt: "desc" },
        take: count,
        include: { classification: true, threadPosts: true, learningCard: true },
      });
      return posts;
    }

    case "random": {
      const allPosts = await prisma.post.findMany({
        where: savedTypeWhere,
        include: { classification: true, threadPosts: true, learningCard: true },
      });
      return shuffleAndTake(allPosts, count);
    }

    case "genre": {
      if (!genre) {
        const allPosts = await prisma.post.findMany({
          where: savedTypeWhere,
          include: { classification: true, threadPosts: true, learningCard: true },
        });
        return shuffleAndTake(allPosts, count);
      }
      const genrePosts = await prisma.post.findMany({
        where: {
          ...savedTypeWhere,
          classification: {
            primaryCategory: genre,
          },
        },
        include: { classification: true, threadPosts: true, learningCard: true },
      });
      return shuffleAndTake(genrePosts, count);
    }

    case "undigested": {
      const posts = await prisma.post.findMany({
        where: {
          ...savedTypeWhere,
          learningCard: null,
        },
        include: { classification: true, threadPosts: true, learningCard: true },
        take: count,
        orderBy: { savedAt: "desc" },
      });
      return posts;
    }

    default:
      return [];
  }
}

function shuffleAndTake<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function getAvailableGenres(): Promise<string[]> {
  const classifications = await prisma.postClassification.findMany({
    select: { primaryCategory: true },
    distinct: ["primaryCategory"],
  });
  return classifications.map((c) => c.primaryCategory);
}
