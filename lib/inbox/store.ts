/**
 * Inbox store — records inbound/outbound messages into unified threads.
 * Shared by the reply poller (inbound) and the send path (outbound).
 *
 * Thread identity: one thread per (org, leadId, channel) when the lead is known.
 * Recording an inbound message marks the thread unread, logs a "replied" activity,
 * and moves the lead to the "replied" stage — which the campaign engine reads to halt
 * or branch the sequence.
 */
import { prisma } from "../db";
import { logActivity } from "../crm";
import type { Channel } from "@prisma/client";

interface InboundInput {
  fromAddr: string;
  toAddr?: string;
  subject?: string;
  body?: string;
  providerMessageId?: string;
  channel?: Channel;
  sentAt?: Date;
}

/** Find the org's lead whose email matches an inbound From address. */
async function matchLead(orgId: string, fromAddr: string) {
  const email = fromAddr.toLowerCase();
  return prisma.lead.findFirst({ where: { organizationId: orgId, email } });
}

async function threadForLead(orgId: string, leadId: string, channel: Channel, subject?: string) {
  const existing = await prisma.inboxThread.findFirst({
    where: { organizationId: orgId, leadId, channel },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existing) return existing;
  return prisma.inboxThread.create({
    data: { organizationId: orgId, leadId, channel, subject: subject ?? null },
  });
}

/**
 * Record an inbound reply. Returns { recorded, matched } — recorded=false means it was
 * a duplicate we've already stored (safe to call every poll).
 */
export async function recordInbound(orgId: string, input: InboundInput): Promise<{ recorded: boolean; matched: boolean }> {
  const channel: Channel = input.channel ?? "email";

  // Dedupe by provider message id within the org.
  if (input.providerMessageId) {
    const dup = await prisma.inboxMessage.findFirst({
      where: { organizationId: orgId, providerMessageId: input.providerMessageId },
    });
    if (dup) return { recorded: false, matched: !!dup.threadId };
  }

  const lead = await matchLead(orgId, input.fromAddr);

  const thread = lead
    ? await threadForLead(orgId, lead.id, channel, input.subject)
    : await prisma.inboxThread.create({
        data: { organizationId: orgId, channel, subject: input.subject ?? null },
      });

  await prisma.inboxMessage.create({
    data: {
      organizationId: orgId,
      threadId: thread.id,
      direction: "inbound",
      fromAddr: input.fromAddr,
      toAddr: input.toAddr,
      subject: input.subject,
      body: input.body,
      providerMessageId: input.providerMessageId,
      sentAt: input.sentAt ?? new Date(),
    },
  });

  await prisma.inboxThread.update({
    where: { id: thread.id },
    data: { status: "unread", lastMessageAt: input.sentAt ?? new Date() },
  });

  if (lead) {
    await logActivity({ organizationId: orgId, leadId: lead.id, type: "replied", channel, meta: { subject: input.subject } });
    await prisma.lead.update({ where: { id: lead.id }, data: { stage: "replied" } });
  }

  return { recorded: true, matched: !!lead };
}

/** Record an outbound message onto the lead's thread (keeps conversations complete). */
export async function recordOutbound(
  orgId: string,
  input: { leadId: string; toAddr?: string; fromAddr?: string; subject?: string; body?: string; providerMessageId?: string; channel?: Channel }
) {
  const channel: Channel = input.channel ?? "email";
  const thread = await threadForLead(orgId, input.leadId, channel, input.subject);
  await prisma.inboxMessage.create({
    data: {
      organizationId: orgId,
      threadId: thread.id,
      direction: "outbound",
      fromAddr: input.fromAddr,
      toAddr: input.toAddr,
      subject: input.subject,
      body: input.body,
      providerMessageId: input.providerMessageId,
    },
  });
  await prisma.inboxThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date() } });
  return thread;
}
