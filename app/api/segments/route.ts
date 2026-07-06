import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { resolveSegmentLeadIds } from "@/lib/segments";

export const runtime = "nodejs";

const FilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  stage: z.string().optional(),
  companyContains: z.string().optional(),
});

const CreateSegment = z.object({
  name: z.string().min(1),
  kind: z.enum(["static", "dynamic"]).default("static"),
  leadIds: z.array(z.string()).optional(),
  filter: FilterSchema.optional(),
});

const UpdateSegment = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  leadIds: z.array(z.string()).optional(), // replace membership
  addLeadIds: z.array(z.string()).optional(), // append to membership
  filter: FilterSchema.optional(),
});

// GET /api/segments — org's groups with live member counts.
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const segments = await prisma.segment.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { createdAt: "desc" },
  });
  const withCounts = await Promise.all(
    segments.map(async (s) => ({ ...s, count: (await resolveSegmentLeadIds(ctx.orgId, s.id)).length }))
  );
  return ok(withCounts);
}

export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = CreateSegment.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");
  const seg = await prisma.segment.create({
    data: {
      organizationId: ctx.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      leadIds: parsed.data.leadIds ?? [],
      filter: (parsed.data.filter ?? {}) as Prisma.InputJsonValue,
    },
  });
  return ok(seg, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = UpdateSegment.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");

  const seg = await prisma.segment.findFirst({ where: { id: parsed.data.id, organizationId: ctx.orgId } });
  if (!seg) return fail("not found", 404);

  const leadIds = parsed.data.addLeadIds
    ? Array.from(new Set([...seg.leadIds, ...parsed.data.addLeadIds]))
    : parsed.data.leadIds ?? undefined;

  const updated = await prisma.segment.update({
    where: { id: seg.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(leadIds ? { leadIds } : {}),
      ...(parsed.data.filter ? { filter: parsed.data.filter as Prisma.InputJsonValue } : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("missing id");
  const res = await prisma.segment.deleteMany({ where: { id, organizationId: ctx.orgId } });
  if (res.count === 0) return fail("not found", 404);
  return ok({ deleted: id });
}
