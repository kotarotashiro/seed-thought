import { NextResponse } from "next/server";
import { generateAuthUrl } from "@/lib/x/oauth";
import { cookies } from "next/headers";
import { getUserFacingError } from "@/lib/api/errors";

export async function GET() {
  try {
    const { url, state, codeVerifier } = generateAuthUrl();

    // Store state and code verifier in cookies for verification during callback
    const cookieStore = await cookies();
    cookieStore.set("x_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600, // 10 minutes
      sameSite: "lax",
    });
    cookieStore.set("x_oauth_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      sameSite: "lax",
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to generate auth URL:", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "X認証URLの生成に失敗しました。") },
      { status: 500 }
    );
  }
}
