/**
 * Lead scoring v1 (product PRD §6): source quality + response speed + qualifying signals
 * extracted from the conversation, combined into one 0-100 number. The three qualifying
 * signals (budget/timeline/decision-maker) are manually set for now — AI-driven
 * extraction from the conversation is Phase 5 (lib/agent.ts's `update_lead_fields` tool)
 * and will write these same fields, at which point this function needs no changes at all.
 */
import { prisma } from "./db";

const BASE = 20; // a captured lead is already worth something
const SIGNAL_WEIGHT = 20; // each of the 3 qualifying signals

export async function computeLeadScore(leadId: string, organizationId: string): Promise<number> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { budgetMentioned: true, timelineMentioned: true, decisionMakerConfirmed: true },
  });
  if (!lead) return 0;

  let score = BASE;
  if (lead.budgetMentioned) score += SIGNAL_WEIGHT;
  if (lead.timelineMentioned) score += SIGNAL_WEIGHT;
  if (lead.decisionMakerConfirmed) score += SIGNAL_WEIGHT;

  // Engagement: has the contact replied, and how fast relative to our first outbound touch?
  // Faster replies are a stronger buying signal than a reply that trickles in a week later.
  const events = await prisma.conversationEvent.findMany({
    where: { organizationId, leadId },
    orderBy: { occurredAt: "asc" },
    select: { direction: true, occurredAt: true },
  });
  const firstOutbound = events.find((e) => e.direction === "outbound");
  const firstReply = firstOutbound
    ? events.find((e) => e.direction === "inbound" && e.occurredAt > firstOutbound.occurredAt)
    : events.find((e) => e.direction === "inbound");

  if (firstReply) {
    if (firstOutbound) {
      const hours = (firstReply.occurredAt.getTime() - firstOutbound.occurredAt.getTime()) / 3_600_000;
      score += hours < 1 ? 20 : hours < 24 ? 12 : 5;
    } else {
      // Inbound-only contact (e.g. a lead source webhook) with no outbound on record yet.
      score += 12;
    }
  }

  return Math.max(0, Math.min(100, score));
}

export async function recomputeAndSaveLeadScore(leadId: string, organizationId: string): Promise<number> {
  const score = await computeLeadScore(leadId, organizationId);
  await prisma.lead.update({ where: { id: leadId }, data: { score } }).catch((e) => {
    console.error("[scoring] failed to save score:", e);
  });
  return score;
}
