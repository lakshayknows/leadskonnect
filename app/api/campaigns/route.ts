import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { CampaignSequence } from "@/lib/campaign-engine";
import { enrollLeads } from "@/lib/enroll";

export const runtime = "nodejs";

const CreateCampaign = z.object({
  name: z.string().min(1),
  // A node graph (see lib/campaign-engine.ts). Accepts a legacy flat step array too.
  sequence: CampaignSequence.default([]),
  sendingAccountId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: ctx.orgId },
    include: { sendingAccount: true, _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(campaigns);
}

export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = CreateCampaign.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");
  const campaign = await prisma.campaign.create({
    data: {
      organizationId: ctx.orgId,
      createdBy: ctx.userId,
      name: parsed.data.name,
      sequence: parsed.data.sequence as unknown as Prisma.InputJsonValue,
      sendingAccountId: parsed.data.sendingAccountId || null,
    },
  });
  return ok(campaign, { status: 201 });
}

// PUT /api/campaigns — launch a campaign to all of an org's leads (kept for the
// existing "Launch" button; targeted enrollment lives at /api/campaigns/[id]/enroll).
const Launch = z.object({ campaignId: z.string(), leadIds: z.array(z.string()).min(1) });

export async function PUT(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = Launch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("expected { campaignId, leadIds[] }");

  const result = await enrollLeads(ctx.orgId, parsed.data.campaignId, parsed.data.leadIds);
  if ("error" in result) return fail(result.error, result.status);
  return ok(result);
}
