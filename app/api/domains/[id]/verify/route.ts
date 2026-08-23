import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { verifyDomainDns } from "@/lib/domains/provision";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/domains/[id]/verify — "Check now".
 *
 * The sweep already re-checks on a backoff, so this exists purely because
 * waiting without being able to do anything is the worst part of DNS setup.
 * It is the same idempotent function the job runs, so pressing it repeatedly
 * costs a few DoH lookups and nothing else.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const domain = await prisma.domain.findFirst({
    where: { id, organizationId: ctx.orgId },
    select: { id: true },
  });
  if (!domain) return fail("Domain not found", 404);

  const result = await verifyDomainDns(domain.id);
  return ok(result);
}
