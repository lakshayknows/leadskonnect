import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg, requireRole } from "@/lib/tenant";
import { listSources } from "@/lib/lead-sources";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok(await listSources(ctx.orgId));
}

const Patch = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(60).optional(),
  monthlyCost: z.number().min(0).max(10_000_000).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  // Editing source cost/labels is a department-configuration action, same tier as
  // creating a pipeline.
  const gate = requireRole(ctx, ["owner", "admin", "group_leader"]);
  if (gate) return gate;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("id is required.", 422);
  const { id, ...data } = parsed.data;

  const existing = await prisma.leadSource.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!existing) return fail("Source not found.", 404);

  const updated = await prisma.leadSource.update({ where: { id }, data });
  return ok({ ...updated, monthlyCost: updated.monthlyCost ? Number(updated.monthlyCost) : null });
}
