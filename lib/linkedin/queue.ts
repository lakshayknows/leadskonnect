/**
 * LinkedIn action queue. Campaigns enqueue actions (the official API can't send
 * invites/DMs); the companion Chrome extension claims and performs them in the user's own
 * logged-in LinkedIn tab, then reports results. Daily caps + stale-claim recovery live here.
 */
import { prisma } from "../db";
import { logActivity } from "../crm";
import { randomUUID } from "node:crypto";

const STALE_MS = 15 * 60 * 1000; // reclaim actions stuck "in_progress" (browser closed mid-run)

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function enqueueLinkedInAction(input: {
  organizationId: string;
  leadId: string;
  linkedinUrl: string;
  note?: string | null;
  campaignId?: string | null;
  type?: string;
}) {
  return prisma.linkedInAction.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId,
      linkedinUrl: input.linkedinUrl,
      note: input.note ?? null,
      campaignId: input.campaignId ?? null,
      type: input.type ?? "auto",
      status: "pending",
    },
  });
}

/** Counts pending + today's throughput for the connect UI. */
export async function queueStats(organizationId: string) {
  const [pending, sentToday, failedToday] = await Promise.all([
    prisma.linkedInAction.count({ where: { organizationId, status: "pending" } }),
    prisma.linkedInAction.count({ where: { organizationId, status: "sent", sentAt: { gte: startOfDay() } } }),
    prisma.linkedInAction.count({ where: { organizationId, status: "failed", updatedAt: { gte: startOfDay() } } }),
  ]);
  return { pending, sentToday, failedToday };
}

/**
 * Hand the extension its next batch of actions, capped by the daily invite limit.
 * Reclaims stale in-progress actions first so a closed browser doesn't strand the queue.
 */
export async function claimActions(organizationId: string, opts: { inviteCap: number; limit: number }) {
  await prisma.linkedInAction.updateMany({
    where: { organizationId, status: "in_progress", updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "pending" },
  });

  const usedToday = await prisma.linkedInAction.count({
    where: { organizationId, status: { in: ["sent", "in_progress"] }, updatedAt: { gte: startOfDay() } },
  });
  const take = Math.min(Math.max(0, opts.inviteCap - usedToday), opts.limit);
  if (take <= 0) return [];

  const pending = await prisma.linkedInAction.findMany({
    where: { organizationId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take,
  });
  if (pending.length === 0) return [];

  await prisma.linkedInAction.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { status: "in_progress" },
  });
  return pending;
}

/** Extension reports the outcome; reflected as a Message + activity so it shows in the CRM. */
export async function completeAction(
  organizationId: string,
  input: { actionId: string; status: "sent" | "failed" | "skipped"; result?: string }
) {
  const action = await prisma.linkedInAction.findFirst({ where: { id: input.actionId, organizationId } });
  if (!action) return null;

  const updated = await prisma.linkedInAction.update({
    where: { id: action.id },
    data: {
      status: input.status,
      result: input.result?.slice(0, 300),
      sentAt: input.status === "sent" ? new Date() : null,
    },
  });

  if (input.status === "sent") {
    await prisma.message
      .create({
        data: {
          organizationId,
          leadId: action.leadId,
          campaignId: action.campaignId ?? undefined,
          channel: "linkedin",
          renderedBody: action.note,
          status: "sent",
          idempotencyKey: randomUUID(),
          sentAt: new Date(),
        },
      })
      .catch(() => {});
    // Move the lead forward from "new" so the pipeline reflects the touch.
    await prisma.lead.updateMany({ where: { id: action.leadId, stage: "new" }, data: { stage: "contacted" } }).catch(() => {});
  }

  await logActivity({
    organizationId,
    leadId: action.leadId,
    campaignId: action.campaignId ?? undefined,
    type: input.status === "sent" ? "linkedin_sent" : `linkedin_${input.status}`,
    channel: "linkedin",
    meta: { actionId: action.id, result: input.result },
  });

  return updated;
}
