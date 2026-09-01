import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { resolveSegmentLeadIds } from "@/lib/segments";
import { enrichLeadRows } from "@/lib/queries";
import { cached, invalidate } from "@/lib/cache";

export const runtime = "nodejs";

// A contact needs an email (Book 1) OR a LinkedIn URL (Book 2).
const CreateLead = z
  .object({
    email: z.string().email().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    linkedinUrl: z.string().url().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    tags: z.array(z.string()).optional(),
    custom: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => d.email || d.linkedinUrl, { message: "add an email or a LinkedIn URL" });

// GET /api/leads?stage=&q=&tags=a,b&company=&book=email|linkedin&group=<segmentId>&page=&pageSize=
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { orgId } = ctx;

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage") ?? undefined;
  const q = searchParams.get("q")?.trim() || undefined;
  const company = searchParams.get("company")?.trim() || undefined;
  const book = searchParams.get("book") ?? undefined; // "email" | "linkedin"
  const group = searchParams.get("group") ?? undefined; // segmentId
  const tags = searchParams.get("tags")?.split(",").map((t) => t.trim()).filter(Boolean);
  const ids = searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean);

  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? searchParams.get("take") ?? 50), 1), 500);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const skip = searchParams.has("skip") ? Number(searchParams.get("skip")) : (page - 1) * pageSize;

  // A saved group resolves to a concrete set of lead ids (static or dynamic).
  const groupIds = group ? await resolveSegmentLeadIds(orgId, group) : undefined;
  const idFilter = ids ?? groupIds;

  const where: Prisma.LeadWhereInput = {
    organizationId: orgId,
    ...(idFilter ? { id: { in: idFilter } } : {}),
    ...(stage ? { stage: stage as never } : {}),
    ...(company ? { company: { equals: company, mode: "insensitive" } } : {}),
    ...(book === "email" ? { email: { not: null } } : book === "linkedin" ? { linkedinUrl: { not: null } } : {}),
    ...(tags && tags.length ? { tags: { hasSome: tags } } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const filterKey = `leads:count:${orgId}:${stage ?? ""}:${company ?? ""}:${book ?? ""}:${group ?? ""}:${(tags ?? []).join("|")}:${q ?? ""}`;
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: pageSize, skip }),
    cached(filterKey, 15_000, () => prisma.lead.count({ where })),
  ]);

  // Source / owner / last activity / next action are all derived, so they're
  // attached here rather than denormalised onto Lead where they'd go stale.
  const items = await enrichLeadRows(orgId, rows);

  return ok({ items, total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) });
}

// POST /api/leads — create/update a contact. Dedupe by (org,email) when an email is given,
// else by (org,linkedinUrl) for LinkedIn-only contacts (Book 2).
export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { orgId } = ctx;

  const parsed = CreateLead.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");

  const { email, custom, ...rest } = parsed.data;
  const customJson = (custom ?? {}) as Prisma.InputJsonValue;

  let lead;
  // Whether this was a create or an update is the single most useful thing the
  // caller can know. Adding an address that already exists updates the row in
  // place and — correctly — leaves `createdAt` alone, so the lead does not move
  // to the top of a newest-first list. Without this flag that reads as "my lead
  // vanished", which is exactly how it was reported.
  let created = true;
  if (email) {
    const existing = await prisma.lead.findUnique({
      where: { organizationId_email: { organizationId: orgId, email } },
      select: { id: true },
    });
    created = !existing;
    lead = await prisma.lead.upsert({
      where: { organizationId_email: { organizationId: orgId, email } },
      create: { email, organizationId: orgId, ...rest, custom: customJson },
      update: { ...rest, ...(custom ? { custom: customJson } : {}) },
    });
  } else {
    // LinkedIn-only contact — dedupe on the profile URL (no composite unique to rely on).
    const existing = await prisma.lead.findFirst({ where: { organizationId: orgId, linkedinUrl: rest.linkedinUrl } });
    created = !existing;
    lead = existing
      ? await prisma.lead.update({ where: { id: existing.id }, data: { ...rest, ...(custom ? { custom: customJson } : {}) } })
      : await prisma.lead.create({ data: { organizationId: orgId, ...rest, custom: customJson } });
  }
  invalidate("leads:");
  invalidate("stats");
  return ok({ ...lead, created }, { status: created ? 201 : 200 });
}
