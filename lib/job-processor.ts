import { prisma } from "./db";
import { safeSend } from "./channels";
import { renderMessage } from "./templates";
import { logActivity } from "./crm";
import { randomUUID } from "node:crypto";
import type { SendJob } from "./queue";

/**
 * Shared job processor.
 * Performs the actual send, updates message status in Postgres, and logs the CRM activity.
 */
export async function processSendJob(jobData: SendJob) {
  const { channel, leadId, campaignId, templateId, account } = jobData;
  
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new Error(`[job-processor] lead ${leadId} not found`);
  }

  const tpl = templateId
    ? await prisma.template.findUnique({ where: { id: templateId } })
    : null;
    
  const rendered = tpl
    ? renderMessage(tpl, lead)
    : { body: "", subject: undefined };

  const result = await safeSend(
    channel,
    {
      id: lead.id,
      email: lead.email,
      phone: lead.phone,
      linkedinUrl: lead.linkedinUrl,
      firstName: lead.firstName,
    },
    rendered,
    account
  );

  await prisma.message.create({
    data: {
      leadId: lead.id,
      campaignId,
      channel,
      templateId,
      renderedSubject: rendered.subject,
      renderedBody: rendered.body,
      status: result.ok ? "sent" : result.skipped ? "queued" : "failed",
      providerId: result.providerId,
      idempotencyKey: randomUUID(),
      sentAt: result.ok ? new Date() : null,
    },
  });

  await logActivity({
    leadId: lead.id,
    campaignId,
    type: result.ok ? "sent" : "failed",
    channel,
    meta: { reason: result.reason, error: result.error },
  });

  // If rate-limited, return a failure indicator so callers can retry (BullMQ or QStash)
  if (!result.ok && result.reason?.startsWith("rate-limited")) {
    throw new Error(result.reason);
  }

  return result;
}
