import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { pollOrgInbox, pollAllInboxes } from "@/lib/inbox/poller";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Reply poller entry point.
 *  - Authenticated user  → polls just their active org (manual "Refresh" in the inbox).
 *  - Cron (Authorization: Bearer CRON_SECRET) → polls every org.
 */
async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authz = req.headers.get("authorization");
  const isCron = cronSecret ? authz === `Bearer ${cronSecret}` : req.headers.get("x-vercel-cron") === "1";

  if (isCron) {
    const result = await pollAllInboxes();
    return ok(result);
  }

  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const summaries = await pollOrgInbox(ctx.orgId);
  return ok({ summaries });
}

export async function GET(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "poll failed", 500));
}

export async function POST(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "poll failed", 500));
}
