import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sweepDueEnrollments } from "@/lib/campaign-engine";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Campaign enrollment recovery sweep.
 *
 * A sequence advances one queue message at a time, so a single dropped or failed publish
 * used to end a lead's sequence silently. This runs every enrollment whose `nextRunAt` is
 * overdue, making the database — not the queue — the source of truth for what is due.
 *
 *  - QStash schedule (signed) / CRON_SECRET → sweeps every org, every 10 min.
 *  - Authenticated user → sweeps just their active org, so a manual hit is a safe,
 *    idempotent "unstick my campaigns" (the per-enrollment claim prevents double sends).
 */
async function handle(req: NextRequest) {
  const rawBody = req.method === "POST" ? await req.clone().text() : "";
  if (await isAuthorizedCron(req, rawBody)) return ok(await sweepDueEnrollments());

  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok(await sweepDueEnrollments({ organizationId: ctx.orgId }));
}

export async function GET(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "sweep failed", 500));
}
export async function POST(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "sweep failed", 500));
}
