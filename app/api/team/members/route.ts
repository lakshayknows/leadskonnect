import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * The org's members with department + manager — fields better-auth's own
 * organization plugin has no concept of, so its client SDK can't return them.
 * This is the source of truth the Team settings screen renders from; role
 * changes, invites and removals still go through better-auth directly.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const members = await prisma.member.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return ok(
    members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      department: m.department,
      managerId: m.managerId,
      user: m.user,
    })),
  );
}
