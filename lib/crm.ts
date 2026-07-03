/**
 * CRM helpers — mirrors docs/crm-data-model.md.
 * Thin wrappers over Prisma; every send path must call `isSuppressed` first.
 */
import { prisma } from "./db";
import type { Channel } from "@prisma/client";

export async function isSuppressed(opts: {
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
}): Promise<boolean> {
  const or: Record<string, string>[] = [];
  if (opts.email) or.push({ email: opts.email });
  if (opts.phone) or.push({ phone: opts.phone });
  if (opts.linkedinUrl) or.push({ linkedinUrl: opts.linkedinUrl });
  if (or.length === 0) return false;
  const hit = await prisma.suppression.findFirst({ where: { OR: or } });
  return !!hit;
}

export async function suppress(
  target: { email?: string; phone?: string; linkedinUrl?: string },
  reason: "unsubscribe" | "bounce" | "gdpr" | "manual"
) {
  return prisma.suppression.upsert({
    where: { email: target.email ?? `no-email-${Date.now()}` },
    create: { ...target, reason },
    update: { reason },
  });
}

export async function logActivity(input: {
  leadId: string;
  campaignId?: string;
  type: string;
  channel?: Channel;
  meta?: Record<string, unknown>;
}) {
  return prisma.activityLog.create({
    data: {
      leadId: input.leadId,
      campaignId: input.campaignId,
      type: input.type,
      channel: input.channel,
      meta: input.meta ?? {},
    },
  });
}

export async function upsertLeadByEmail(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  linkedinUrl?: string;
  company?: string;
  title?: string;
  custom?: Record<string, unknown>;
}) {
  const { email, custom, ...rest } = data;
  return prisma.lead.upsert({
    where: { email },
    create: { email, ...rest, custom: custom ?? {} },
    update: { ...rest, ...(custom ? { custom } : {}) },
  });
}
