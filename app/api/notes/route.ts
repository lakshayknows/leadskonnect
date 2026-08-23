import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";

export const runtime = "nodejs";

const Create = z.object({
  leadId: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("A lead and some text are required.", 422);

  // Confirm the lead is this org's before writing a row that points at it.
  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, organizationId: ctx.orgId },
    select: { id: true },
  });
  if (!lead) return fail("Lead not found.", 404);

  const note = await prisma.note.create({
    data: {
      organizationId: ctx.orgId,
      leadId: lead.id,
      authorId: ctx.userId,
      body: parsed.data.body,
    },
  });
  return ok(note);
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("A note id is required.", 422);

  const res = await prisma.note.deleteMany({ where: { id, organizationId: ctx.orgId } });
  if (res.count === 0) return fail("Note not found.", 404);
  return ok({ deleted: true });
}
