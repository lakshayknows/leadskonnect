import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sweepSlaBreaches, sweepAllOrgsSlaBreaches } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * SLA breach sweep entry point.
 *  - QStash schedule (signed) / CRON_SECRET → sweeps every org, every 15 min.
 *  - Authenticated user → sweeps just their active org (matches GET /api/ageing's
 *    sweep-on-read, so a manual hit here is harmless and idempotent).
 */
async function handle(req: NextRequest) {
  const rawBody = req.method === "POST" ? await req.clone().text() : "";
  if (await isAuthorizedCron(req, rawBody)) return ok(await sweepAllOrgsSlaBreaches());

  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok(await sweepSlaBreaches(ctx.orgId));
}

export async function GET(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "sweep failed", 500));
}
export async function POST(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "sweep failed", 500));
}
