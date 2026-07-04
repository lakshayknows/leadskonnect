import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireDb } from "@/lib/http";
import { enqueueSend } from "@/lib/queue";
import { jitterMs } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Step = z.object({
  channel: z.enum(["email", "linkedin", "whatsapp", "social"]),
  templateId: z.string().optional(),
  waitDays: z.number().min(0).default(0),
  unless: z.string().optional(), // e.g. "replied"
  onlyIf: z.string().optional(), // e.g. "phone_opt_in"
});

const CreateCampaign = z.object({
  name: z.string().min(1),
  sequence: z.array(Step).default([]),
  sendingAccountId: z.string().optional().nullable(),
});

export async function GET() {
  const guard = requireDb();
  if (guard) return guard;
  const campaigns = await prisma.campaign.findMany({ 
    include: { sendingAccount: true },
    orderBy: { createdAt: "desc" } 
  });
  return ok(campaigns);
}

export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;
  const parsed = CreateCampaign.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");
  const campaign = await prisma.campaign.create({
    data: { 
      name: parsed.data.name, 
      sequence: parsed.data.sequence,
      sendingAccountId: parsed.data.sendingAccountId || null
    },
  });
  return ok(campaign, { status: 201 });
}

// PUT /api/campaigns — launch a campaign (enqueue sequence steps per lead)
const Launch = z.object({ campaignId: z.string(), leadIds: z.array(z.string()).min(1) });

export async function PUT(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;
  const parsed = Launch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("expected { campaignId, leadIds[] }");

  const campaign = await prisma.campaign.findUnique({ where: { id: parsed.data.campaignId } });
  if (!campaign) return fail("campaign not found", 404);

  const steps = (campaign.sequence as Array<z.infer<typeof Step>>) ?? [];
  if (steps.length === 0) return fail("campaign has no sequence");

  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "active" } });

  let enqueued = 0;
  let queueAvailable = true;
  for (const leadId of parsed.data.leadIds) {
    let cumulativeDelay = 0;
    for (const step of steps) {
      cumulativeDelay += step.waitDays * 24 * 60 * 60 * 1000 + jitterMs();
      const didQueue = await enqueueSend(
        { 
          channel: step.channel, 
          leadId, 
          campaignId: campaign.id, 
          templateId: step.templateId,
          account: campaign.sendingAccountId || "default"
        },
        cumulativeDelay
      );
      if (!didQueue) queueAvailable = false;
      else enqueued++;
    }
  }

  return ok({
    launched: campaign.id,
    enqueued,
    queueAvailable,
    note: queueAvailable ? undefined : "REDIS_URL not set — jobs not queued. Set it or rely on local dev inline fallback.",
  });
}
