import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { runWarmupForOrg, runAllWarmups } from "@/lib/warmup";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Warm-up runner.
 *  - Authenticated user → runs just their org (manual "Run now").
 *  - Cron (Authorization: Bearer CRON_SECRET / x-vercel-cron) → runs every org.
 */
async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authz = req.headers.get("authorization");
  const isCron = cronSecret ? authz === `Bearer ${cronSecret}` : req.headers.get("x-vercel-cron") === "1";

  if (isCron) return ok(await runAllWarmups());

  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok(await runWarmupForOrg(ctx.orgId));
}

export async function GET(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "warmup failed", 500));
}
export async function POST(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "warmup failed", 500));
}
