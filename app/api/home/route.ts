import type { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { getHome } from "@/lib/queries";

export const runtime = "nodejs";

// GET /api/home — the action-first dashboard payload: what needs attention now,
// what's due, what arrived today. Analytics stay on /api/reports; this is a work
// queue, not a scoreboard.
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok(await getHome(ctx.orgId));
}
