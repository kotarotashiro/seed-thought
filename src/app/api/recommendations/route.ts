import { NextResponse } from "next/server";
import { selectRecommendations, getAvailableGenres, type SelectionMode } from "@/lib/recommendations/selectRecommendations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = (searchParams.get("mode") || "latest") as SelectionMode;
  const genre = searchParams.get("genre") || undefined;
  const savedType = searchParams.get("savedType") || undefined;

  try {
    const posts = await selectRecommendations(mode, genre, savedType);
    const genres = await getAvailableGenres();

    return NextResponse.json({ posts, genres });
  } catch (error) {
    console.error("Failed to fetch recommendations:", error);
    return NextResponse.json({ error: "候補の取得に失敗しました" }, { status: 500 });
  }
}
