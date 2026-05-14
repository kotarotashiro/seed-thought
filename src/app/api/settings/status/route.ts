import { NextResponse } from "next/server";

export async function GET() {
  const configuredProvider = process.env.AI_PROVIDER || "gemini";
  const aiProvider =
    process.env.NODE_ENV === "production" && configuredProvider === "mock"
      ? "gemini"
      : configuredProvider;

  return NextResponse.json({
    aiProvider,
  });
}
