import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg, requireRole } from "@/lib/tenant";

export const runtime = "nodejs";

const Patch = z.object({
  department: z.enum(["marketing", "sales", "support", "collections", "recruitment"]).nullable().optional(),
  managerId: z.string().nullable().optional(),
});

/**
 * Department + manager assignment — org-hierarchy config, one tier stricter
 * than pipeline/source editing (owner/admin only, not group leaders), since
 * this is what the SLA escalation chain in lib/pipeline.ts walks.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const gate = requireRole(ctx, ["owner", "admin"]);
  if (gate) return gate;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pass a department and/or a manager to update.", 422);

  const member = await prisma.member.findFirst({ where: { id: memberId, organizationId: ctx.orgId } });
  if (!member) return fail("Member not found.", 404);

  const { managerId } = parsed.data;
  if (managerId) {
    if (managerId === memberId) return fail("A member can't be their own manager.", 422);
    const manager = await prisma.member.findFirst({ where: { id: managerId, organizationId: ctx.orgId } });
    if (!manager) return fail("That manager isn't in this workspace.", 422);
    // One level of cycle prevention: a member can't manage the person already set as
    // their own manager. Deeper chains aren't checked — the hierarchy is shallow by
    // design (rep -> group leader -> admin), so this catches the realistic mistake.
    if (manager.managerId === memberId) return fail("That would create a reporting cycle.", 422);
  }

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: parsed.data,
  });
  return ok({ id: updated.id, department: updated.department, managerId: updated.managerId });
}
