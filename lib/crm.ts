/**
 * CRM helpers — mirrors docs/crm-data-model.md.
 * Thin wrappers over Prisma; every send path must call `isSuppressed` first.
 */
import { prisma } from "./db";
import { Prisma, type Channel } from "@prisma/client";

export async function isSuppressed(
  orgId: string,
  opts: {
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
  }
): Promise<boolean> {
  const or: Record<string, string>[] = [];
  if (opts.email) or.push({ email: opts.email });
  if (opts.phone) or.push({ phone: opts.phone });
  if (opts.linkedinUrl) or.push({ linkedinUrl: opts.linkedinUrl });
  if (or.length === 0) return false;
  const hit = await prisma.suppression.findFirst({ where: { organizationId: orgId, OR: or } });
  return !!hit;
}

export async function suppress(
  orgId: string,
  target: { email?: string; phone?: string; linkedinUrl?: string },
  reason: "unsubscribe" | "bounce" | "gdpr" | "manual"
) {
  return prisma.suppression.upsert({
    where: { organizationId_email: { organizationId: orgId, email: target.email ?? `no-email-${Date.now()}` } },
    create: { ...target, organizationId: orgId, reason },
    update: { reason },
  });
}

export async function logActivity(input: {
  organizationId?: string | null;
  leadId: string;
  campaignId?: string;
  messageId?: string;
  type: string;
  channel?: Channel;
  meta?: Record<string, unknown>;
}) {
  return prisma.activityLog.create({
    data: {
      organizationId: input.organizationId ?? undefined,
      leadId: input.leadId,
      campaignId: input.campaignId,
      messageId: input.messageId,
      type: input.type,
      channel: input.channel,
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function upsertLeadByEmail(
  orgId: string,
  data: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    linkedinUrl?: string;
    company?: string;
    title?: string;
    tags?: string[];
    custom?: Record<string, unknown>;
  }
) {
  const { email, custom, ...rest } = data;
  return prisma.lead.upsert({
    where: { organizationId_email: { organizationId: orgId, email } },
    create: { email, organizationId: orgId, ...rest, custom: (custom ?? {}) as Prisma.InputJsonValue },
    update: { ...rest, ...(custom ? { custom: custom as Prisma.InputJsonValue } : {}) },
  });
}
