import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, fail, requireDb } from "@/lib/http";
import { cached, invalidate } from "@/lib/cache";

export const runtime = "nodejs";

const CreateLead = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/leads?stage=&q=&page=&pageSize=  (also accepts legacy take/skip)
export async function GET(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage") ?? undefined;
  const q = searchParams.get("q")?.trim() || undefined;

  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? searchParams.get("take") ?? 50), 1), 200);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const skip = searchParams.has("skip") ? Number(searchParams.get("skip")) : (page - 1) * pageSize;

  const where: Prisma.LeadWhereInput = {
    ...(stage ? { stage: stage as never } : {}),
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

  // The count is the expensive part as leads grow — cache it briefly per filter.
  const filterKey = `leads:count:${stage ?? ""}:${q ?? ""}`;
  const [items, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: pageSize, skip }),
    cached(filterKey, 15_000, () => prisma.lead.count({ where })),
  ]);

  return ok({ items, total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) });
}

// POST /api/leads  (upsert by email)
export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;

  const parsed = CreateLead.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");

  const { email, custom, ...rest } = parsed.data;
  const lead = await prisma.lead.upsert({
    where: { email },
    create: { email, ...rest, custom: (custom ?? {}) as Prisma.InputJsonValue },
    update: { ...rest, ...(custom ? { custom: custom as Prisma.InputJsonValue } : {}) },
  });
  invalidate("leads:");
  invalidate("stats");
  return ok(lead, { status: 201 });
}
