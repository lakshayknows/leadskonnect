import type { NextRequest } from "next/server";
import type { Department } from "@prisma/client";
import { ok } from "@/lib/http";
import { requireOrg, isDepartmentScoped } from "@/lib/tenant";
import { getControlTower } from "@/lib/conversation";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const department = (isDepartmentScoped(ctx) ? ctx.department : undefined) as Department | undefined;
  return ok(await getControlTower(ctx.orgId, 100, department));
}
