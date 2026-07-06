import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { pollOrgInbox, pollAllInboxes } from "@/lib/inbox/poller";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Reply poller entry point.
 *  - QStash schedule (signed) / CRON_SECRET → polls every org.
 *  - Authenticated user → polls just their active org (manual "Refresh" in the inbox).
 */
async function handle(req: NextRequest) {
  const rawBody = req.method === "POST" ? await req.clone().text() : "";
  if (await isAuthorizedCron(req, rawBody)) return ok(await pollAllInboxes());

  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok({ summaries: await pollOrgInbox(ctx.orgId) });
}

export async function GET(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "poll failed", 500));
}
export async function POST(req: NextRequest) {
  return handle(req).catch((e) => fail(e instanceof Error ? e.message : "poll failed", 500));
}
