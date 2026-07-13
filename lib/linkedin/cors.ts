import { NextResponse } from "next/server";

// The extension (popup + Options page) calls these endpoints cross-origin with a bearer
// token — not cookies — so permissive CORS is safe.
export const LINKEDIN_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-ext-token",
};

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: LINKEDIN_CORS });
}

export function withCors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(LINKEDIN_CORS)) res.headers.set(k, v);
  return res;
}
