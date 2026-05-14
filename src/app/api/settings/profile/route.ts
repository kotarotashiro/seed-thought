import { NextResponse } from "next/server";
import { getProfile, normalizeProfile, saveProfile } from "@/lib/profile/fixedProfile";

export async function GET() {
  try {
    const profile = await getProfile();
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json(
      { error: "プロフィール設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const profile = normalizeProfile(body);
    const saved = await saveProfile(profile);
    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save profile:", error);
    return NextResponse.json(
      { error: "プロフィール設定の保存に失敗しました" },
      { status: 500 }
    );
  }
}
