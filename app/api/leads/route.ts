import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, fail, requireDb } from "@/lib/http";

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

// GET /api/leads?stage=&q=&take=&skip=
export async function GET(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const take = Math.min(Number(searchParams.get("take") ?? 50), 200);
  const skip = Number(searchParams.get("skip") ?? 0);

  const leads = await prisma.lead.findMany({
    where: {
      ...(stage ? { stage: stage as never } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
  return ok(leads);
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
  return ok(lead, { status: 201 });
}
