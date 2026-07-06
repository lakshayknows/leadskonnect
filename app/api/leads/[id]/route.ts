import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { invalidate } from "@/lib/cache";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Fields the client is allowed to PATCH (never id / organizationId / relations).
const PATCHABLE = new Set([
  "firstName", "lastName", "email", "phone", "linkedinUrl", "company", "title", "stage", "tags", "custom", "optedOut", "consent",
]);

export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 50 }, activities: { orderBy: { at: "desc" }, take: 50 } },
  });
  if (!lead) return fail("not found", 404);
  return ok(lead);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = Object.fromEntries(Object.entries(body).filter(([k]) => PATCHABLE.has(k)));
  // Scope the update to this org so a foreign id can't be mutated.
  const res = await prisma.lead.updateMany({ where: { id, organizationId: ctx.orgId }, data });
  if (res.count === 0) return fail("not found", 404);
  const lead = await prisma.lead.findUnique({ where: { id } });
  return ok(lead);
}

// DELETE = GDPR erase
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!lead) return fail("not found", 404);
  if (lead.email) {
    await prisma.suppression.upsert({
      where: { organizationId_email: { organizationId: ctx.orgId, email: lead.email } },
      create: { organizationId: ctx.orgId, email: lead.email, reason: "gdpr" },
      update: { reason: "gdpr" },
    });
  }
  await prisma.lead.delete({ where: { id } });
  invalidate("leads:");
  invalidate("stats");
  return ok({ deleted: true });
}
