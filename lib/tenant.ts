/**
 * Multi-tenancy — resolve the authenticated user + their active organization.
 *
 * Every API route must scope reads/writes to `orgId`. Use `requireOrg(req)` in route
 * handlers (returns a Response to short-circuit on auth failure) and `getServerTenant()`
 * in Server Components (returns null when unauthenticated).
 */
import type { NextRequest } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./db";
import { fail } from "./http";
import { configured } from "./env";

export interface TenantContext {
  userId: string;
  orgId: string;
  role: string; // owner | admin | member
}

/** Resolve tenant from a set of request headers (shared by route + RSC paths). */
async function resolveTenant(headers: Headers): Promise<TenantContext | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user) return null;
  const userId = session.user.id;
  const active = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;

  // Prefer the session's active org; fall back to the user's first membership.
  let membership = active
    ? await prisma.member.findFirst({ where: { userId, organizationId: active } })
    : null;
  if (!membership) {
    membership = await prisma.member.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  }
  if (!membership) return null;
  return { userId, orgId: membership.organizationId, role: membership.role };
}

/**
 * For API route handlers. Returns the tenant context, or a Response (401/403/503) that
 * the caller must return to short-circuit:
 *   const ctx = await requireOrg(req);
 *   if (ctx instanceof Response) return ctx;
 *   const { orgId } = ctx;
 */
export async function requireOrg(req: NextRequest): Promise<TenantContext | Response> {
  if (!configured.db) return fail("DATABASE_URL not configured — see .env.example", 503);
  const ctx = await resolveTenant(req.headers);
  if (!ctx) return fail("unauthorized", 401);
  return ctx;
}

/** For Server Components. Returns null when unauthenticated / no org. */
export async function getServerTenant(): Promise<TenantContext | null> {
  if (!configured.db) return null;
  return resolveTenant(await nextHeaders());
}

/** Role gate helper — throws a Response when the caller lacks the required role. */
export function requireRole(ctx: TenantContext, roles: string[]): Response | null {
  if (!roles.includes(ctx.role)) return fail("insufficient role", 403);
  return null;
}
