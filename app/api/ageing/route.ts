import type { NextRequest } from "next/server";
import type { Department } from "@prisma/client";
import { ok } from "@/lib/http";
import { requireOrg, isDepartmentScoped } from "@/lib/tenant";
import { getAgeing, sweepSlaBreaches, getAiMoveShare } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  // Sweep on read so the list and the escalation log can never disagree.
  await sweepSlaBreaches(ctx.orgId);
  // Group leaders/members (PRD §4) only ever see their own department; owner/admin see all.
  const department = (isDepartmentScoped(ctx) ? ctx.department : undefined) as Department | undefined;
  const [items, aiShare] = await Promise.all([getAgeing(ctx.orgId, 100, department), getAiMoveShare(ctx.orgId)]);
  return ok({ items, aiShare });
}
