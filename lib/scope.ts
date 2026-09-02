/**
 * Who can see which contacts — one rule, applied everywhere.
 *
 * Before this, every read was scoped to the organization and nothing further, so
 * a new hire on their first day saw the whole company's book: every contact,
 * every reply, every overdue task. That is fine for a single-operator tool and
 * wrong for a product sold to teams.
 *
 * The rule:
 *   owner / admin   → the whole workspace
 *   group_leader    → their department's contacts, that department's unassigned
 *                     pool, and anything they added themselves
 *   member          → assigned to them, added by them, or unassigned in their
 *                     department (the pool they may claim from)
 *
 * Unassigned contacts stay visible rather than hidden, deliberately: a freshly
 * imported list belongs to nobody yet, and a pool nobody can see is a pool
 * nobody works.
 *
 * `viewAs` powers the owner's "View: All team ▼" drill-down. It narrows to one
 * person *within* what the caller may already see, so it can only ever subtract.
 * That is what lets one rendering path serve both the member's own dashboard and
 * the owner looking at that member.
 */
import { prisma } from "./db";
import { seesEverything } from "./roles";
import type { TenantContext } from "./tenant";
import type { Department, Prisma } from "@prisma/client";

/** userIds of everyone in the caller's department (plus the caller). */
async function departmentUserIds(ctx: TenantContext): Promise<string[]> {
  if (!ctx.department) return [ctx.userId];
  const members = await prisma.member.findMany({
    where: { organizationId: ctx.orgId, department: ctx.department as Department },
    select: { userId: true },
  });
  const ids = members.map((m) => m.userId);
  if (!ids.includes(ctx.userId)) ids.push(ctx.userId);
  return ids;
}

export interface LeadScope {
  where: Prisma.LeadWhereInput;
  /** userIds this scope covers, or null when the scope is the whole org. */
  userIds: string[] | null;
}

/**
 * Build the Lead `where` for this caller.
 *
 * Always spreads over `organizationId`, so it can be handed straight to a query
 * without the caller remembering to add tenancy on top.
 */
export async function leadScope(ctx: TenantContext, viewAs?: string | null): Promise<LeadScope> {
  const org: Prisma.LeadWhereInput = { organizationId: ctx.orgId };

  // Drill-down to one person. Authorization for *who* may be named is the
  // caller's business (see canViewAs) — by the time we are here it is allowed.
  if (viewAs) {
    return {
      where: { ...org, OR: [{ ownerId: viewAs }, { createdById: viewAs }] },
      userIds: [viewAs],
    };
  }

  if (seesEverything(ctx.role)) return { where: org, userIds: null };

  const ids = await departmentUserIds(ctx);

  if (ctx.role === "group_leader") {
    return {
      where: {
        ...org,
        OR: [
          { ownerId: { in: ids } },
          { createdById: { in: ids } },
          // The department's unclaimed pool.
          { ownerId: null },
        ],
      },
      userIds: ids,
    };
  }

  // Plain member.
  return {
    where: {
      ...org,
      OR: [{ ownerId: ctx.userId }, { createdById: ctx.userId }, { ownerId: null }],
    },
    userIds: [ctx.userId],
  };
}

/**
 * May this caller view the workspace as `targetUserId`?
 *
 * Owners and admins may name anyone in the org. A manager may name someone in
 * their own department. Everyone may name themselves — which is what makes
 * `?member=<me>` harmless rather than a special case.
 */
export async function canViewAs(ctx: TenantContext, targetUserId: string): Promise<boolean> {
  if (targetUserId === ctx.userId) return true;
  if (seesEverything(ctx.role)) {
    const member = await prisma.member.findFirst({
      where: { organizationId: ctx.orgId, userId: targetUserId },
      select: { id: true },
    });
    return !!member;
  }
  if (ctx.role !== "group_leader" || !ctx.department) return false;
  const member = await prisma.member.findFirst({
    where: { organizationId: ctx.orgId, userId: targetUserId, department: ctx.department as Department },
    select: { id: true },
  });
  return !!member;
}

/**
 * Resolve the `?member=` query parameter into a validated viewAs id.
 *
 * Returns `undefined` when absent, `null` when present but not permitted — the
 * caller should treat null as a 403 rather than silently widening the view,
 * which would be the worst possible failure mode for this particular feature.
 */
export async function resolveViewAs(
  ctx: TenantContext,
  raw: string | null | undefined
): Promise<string | null | undefined> {
  if (!raw) return undefined;
  return (await canViewAs(ctx, raw)) ? raw : null;
}
