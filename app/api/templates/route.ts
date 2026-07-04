import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireDb } from "@/lib/http";
import { SEED_TEMPLATES } from "@/lib/templates-seed";

export const runtime = "nodejs";

const CreateTemplate = z.object({
  channel: z.enum(["email", "linkedin", "whatsapp", "social"]),
  name: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export async function GET() {
  const guard = requireDb();
  if (guard) return guard;
  
  let templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  
  if (templates.length === 0) {
    console.log("[templates] Seeding 5 default templates...");
    await prisma.template.createMany({
      data: SEED_TEMPLATES,
    });
    templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  }
  
  return ok(templates);
}

export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;
  const parsed = CreateTemplate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");
  const tpl = await prisma.template.create({ data: parsed.data });
  return ok(tpl, { status: 201 });
}
