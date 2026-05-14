import { NextResponse } from "next/server";
import { getUserFacingError } from "@/lib/api/errors";
import { syncXPosts } from "@/lib/x/sync";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { syncType = "both", limit = 25 } = body;

    const validTypes = ["likes", "bookmarks", "both"];
    if (!validTypes.includes(syncType)) {
      return NextResponse.json(
        { error: "syncTypeは likes, bookmarks, both のいずれかを指定してください" },
        { status: 400 }
      );
    }

    const validLimits = [10, 25, 50, 100];
    const safeLimit = validLimits.includes(limit) ? limit : 25;

    const result = await syncXPosts(syncType, safeLimit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync failed:", error);
    const errorMessage = getUserFacingError(error, "同期に失敗しました");
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
