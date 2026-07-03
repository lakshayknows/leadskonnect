import { NextResponse } from "next/server";
import { configured } from "./env";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Guard for routes that need the database. */
export function requireDb() {
  if (!configured.db) {
    return fail("DATABASE_URL not configured — see .env.example", 503);
  }
  return null;
}
