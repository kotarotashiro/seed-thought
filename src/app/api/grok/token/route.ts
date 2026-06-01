import { NextResponse } from "next/server";
import { getUserFacingError } from "@/lib/api/errors";
import { saveXaiTokens } from "@/lib/xai/authStore";

// Token ingest endpoint for the local reconnect script (scripts/grok-reconnect.mjs).
//
// xAI's subscription OAuth only allows a localhost loopback redirect, so the
// OAuth handshake must happen on the user's machine. The local script performs
// that handshake, then POSTs the resulting tokens here so they land in the
// PRODUCTION database (encrypted server-side). This avoids running a full dev
// server or pointing local dev at the production DATABASE_URL.
//
// Protected by CRON_SECRET (already used by the cron endpoints).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

interface TokenIngestBody {
  accessToken?: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scope?: string;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as TokenIngestBody;

    if (!body.accessToken) {
      return NextResponse.json(
        { error: "accessToken is required" },
        { status: 400 }
      );
    }

    await saveXaiTokens({
      accessToken: body.accessToken,
      refreshToken: body.refreshToken ?? undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      scope: body.scope ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[grok/token]", error);
    return NextResponse.json(
      { error: getUserFacingError(error, "トークンの保存に失敗しました") },
      { status: 500 }
    );
  }
}
