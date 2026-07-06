import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { invalidate } from "@/lib/cache";

export const runtime = "nodejs";

// Bulk lead actions: add/remove tags, add to a static group/segment.
const Body = z.object({
  leadIds: z.array(z.string()).min(1),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
  segmentId: z.string().optional(), // append these leads to a static segment
});

export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");
  const { leadIds, addTags, removeTags, segmentId } = parsed.data;

  // Only operate on the org's own leads.
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, organizationId: ctx.orgId },
    select: { id: true, tags: true },
  });

  if (addTags?.length || removeTags?.length) {
    for (const lead of leads) {
      let tags = lead.tags;
      if (addTags?.length) tags = Array.from(new Set([...tags, ...addTags]));
      if (removeTags?.length) tags = tags.filter((t) => !removeTags.includes(t));
      await prisma.lead.update({ where: { id: lead.id }, data: { tags } });
    }
    invalidate("leads:");
  }

  if (segmentId) {
    const seg = await prisma.segment.findFirst({ where: { id: segmentId, organizationId: ctx.orgId } });
    if (!seg) return fail("segment not found", 404);
    const merged = Array.from(new Set([...seg.leadIds, ...leads.map((l) => l.id)]));
    await prisma.segment.update({ where: { id: seg.id }, data: { leadIds: merged } });
  }

  return ok({ updated: leads.length });
}
