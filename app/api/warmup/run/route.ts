import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runWarmupForOrg, runAllWarmups } from "@/lib/warmup";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Warm-up runner.
 *  - QStash schedule (signed) / CRON_SECRET → runs every org.
 *  - Authenticated user → runs just their org (manual "Run now").
 */
async function handle(req: NextRequest) {
  const rawBody = req.method === "POST" ? await req.clone().text() : "";
  if (await isAuthorizedCron(req, rawBody)) return ok(await runAllWarmups());

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
