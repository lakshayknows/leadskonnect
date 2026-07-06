import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { CampaignSequence } from "@/lib/campaign-engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/campaigns/[id] — fetch a single campaign */
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: { sendingAccount: true, _count: { select: { enrollments: true } } },
  });
  if (!campaign) return fail("Campaign not found", 404);
  return ok(campaign);
}

const UpdateCampaign = z.object({
  name: z.string().min(1).optional(),
  sequence: CampaignSequence.optional(),
  sendingAccountId: z.string().nullable().optional(),
  status: z.enum(["active", "paused", "done"]).optional(),
});

/** PATCH /api/campaigns/[id] — update name / sequence / sending account */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  // Verify ownership
  const existing = await prisma.campaign.findFirst({
    where: { id, organizationId: ctx.orgId },
  });
  if (!existing) return fail("Campaign not found", 404);

  const parsed = UpdateCampaign.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");

  const data: Prisma.CampaignUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.sequence !== undefined)
    data.sequence = parsed.data.sequence as unknown as Prisma.InputJsonValue;
  if ("sendingAccountId" in parsed.data)
    data.sendingAccount = parsed.data.sendingAccountId
      ? { connect: { id: parsed.data.sendingAccountId } }
      : { disconnect: true };

  const updated = await prisma.campaign.update({ where: { id }, data });
  return ok(updated);
}

/** DELETE /api/campaigns/[id] */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const existing = await prisma.campaign.findFirst({
    where: { id, organizationId: ctx.orgId },
  });
  if (!existing) return fail("Campaign not found", 404);

  await prisma.campaign.delete({ where: { id } });
  return ok({ deleted: true });
}
