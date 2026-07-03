import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, requireDb } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = requireDb();
  if (guard) return guard;
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 50 }, activities: { orderBy: { at: "desc" }, take: 50 } },
  });
  if (!lead) return fail("not found", 404);
  return ok(lead);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = requireDb();
  if (guard) return guard;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const lead = await prisma.lead.update({ where: { id }, data: body }).catch(() => null);
  if (!lead) return fail("not found", 404);
  return ok(lead);
}

// DELETE = GDPR erase
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const guard = requireDb();
  if (guard) return guard;
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return fail("not found", 404);
  if (lead.email) {
    await prisma.suppression.upsert({
      where: { email: lead.email },
      create: { email: lead.email, reason: "gdpr" },
      update: { reason: "gdpr" },
    });
  }
  await prisma.lead.delete({ where: { id } });
  return ok({ deleted: true });
}
