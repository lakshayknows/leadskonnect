import type { NextRequest } from "next/server";
import type { Department } from "@prisma/client";
import { ok } from "@/lib/http";
import { requireOrg, isDepartmentScoped } from "@/lib/tenant";
import { getEscalations } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  // Group leaders/members (PRD §4) only ever see their own department; owner/admin see all.
  const department = (isDepartmentScoped(ctx) ? ctx.department : undefined) as Department | undefined;
  return ok(await getEscalations(ctx.orgId, 100, department));
}
