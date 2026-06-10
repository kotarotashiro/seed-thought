import { NextResponse } from "next/server";
import { getUserFacingError } from "@/lib/api/errors";
import { syncXPosts } from "@/lib/x/sync";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { syncType = "likes", limit = 25, postedFrom, postedTo } = body;

    const validTypes = ["likes", "bookmarks", "both"];
    if (!validTypes.includes(syncType)) {
      return NextResponse.json(
        { error: "syncTypeは likes, bookmarks, both のいずれかを指定してください" },
        { status: 400 }
      );
    }

    const validLimits = [10, 25, 50, 100, 200, 500];
    const safeLimit = validLimits.includes(limit) ? limit : 25;
    const dateRange = {
      from: typeof postedFrom === "string" && postedFrom ? new Date(`${postedFrom}T00:00:00`) : null,
      to: typeof postedTo === "string" && postedTo ? new Date(`${postedTo}T23:59:59.999`) : null,
    };

    const result = await syncXPosts(syncType, safeLimit, dateRange);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync failed:", error);
    const errorMessage = getUserFacingError(error, "同期に失敗しました");
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
