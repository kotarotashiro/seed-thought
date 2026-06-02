import { NextResponse } from "next/server";
import { runResearch, runDeepResearch, getResearchHistory } from "@/lib/research/run";

export const maxDuration = 300;

export async function GET() {
  try {
    const history = await getResearchHistory();
    return NextResponse.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: string; mode?: string };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "クエリを入力してください" }, { status: 400 });
    }
    const result = body.mode === "deep" ? await runDeepResearch(query) : await runResearch(query);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
