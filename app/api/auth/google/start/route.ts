import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { env, configured } from "@/lib/env";

export const runtime = "nodejs";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

/**
 * Kick off the Google OAuth consent flow for connecting a Gmail sending account.
 * Redirects the browser to Google's consent screen. On approval Google calls
 * /api/auth/google/callback with an authorization code.
 */
export async function GET() {
  if (!configured.google) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured" },
      { status: 503 }
    );
  }

  const state = randomUUID();
  const redirectUri = `${env.appUrl}/api/auth/google/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.google.clientId!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline"); // request a refresh token
  url.searchParams.set("prompt", "consent"); // force refresh token every time
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  // Short-lived CSRF cookie, validated in the callback.
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
