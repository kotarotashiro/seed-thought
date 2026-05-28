import { NextResponse } from "next/server";
import { getAiPublicSettings } from "@/lib/ai/settings";

export async function GET() {
  const ai = await getAiPublicSettings();

  return NextResponse.json({
    aiProvider: ai.defaultProvider,
    ai,
  });
}
