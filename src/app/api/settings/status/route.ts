import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    aiProvider: process.env.AI_PROVIDER || "gemini",
  });
}
