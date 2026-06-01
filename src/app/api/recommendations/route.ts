import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { selectRecommendations, getAvailableGenres, type SelectionMode } from "@/lib/recommendations/selectRecommendations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = (searchParams.get("mode") || "latest") as SelectionMode;
  const genre = searchParams.get("genre") || undefined;
  const savedType = searchParams.get("savedType") || undefined;

  try {
    const [posts, genres] = await Promise.all([
      selectRecommendations(mode, genre, savedType),
      getAvailableGenres(),
    ]);

    let undigestedTotal: number | undefined;
    if (mode === "undigested") {
      undigestedTotal = await prisma.post.count({ where: { learningCard: null } });
    }

    return NextResponse.json({ posts, genres, undigestedTotal });
  } catch (error) {
    console.error("Failed to fetch recommendations:", error);
    return NextResponse.json({ error: "候補の取得に失敗しました" }, { status: 500 });
  }
}
