import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sweepDueDomains } from "@/lib/domains/provision";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Domain fulfilment sweep.
 *  - QStash schedule (signed) / CRON_SECRET → every org, every 5 minutes.
 *  - Authenticated user → same sweep; it is idempotent, so a manual hit is safe.
 *
 * This is the safety net that makes the queue optional rather than load-bearing:
 * `Domain.nextCheckAt` decides what is due and paid-but-unfulfilled orders get
 * re-enqueued, so a dropped message costs a few minutes rather than stranding
 * something somebody paid for.
 */
async function handle(req: NextRequest) {
  const rawBody = req.method === "POST" ? await req.clone().text() : "";
  if (await isAuthorizedCron(req, rawBody)) return ok(await sweepDueDomains());

  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok(await sweepDueDomains());
}

export async function GET(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "sweep failed", 500));
}
export async function POST(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "sweep failed", 500));
}
