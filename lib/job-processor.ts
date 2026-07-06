import { prisma } from "./db";
import { safeSend } from "./channels";
import { renderMessage } from "./templates";
import { logActivity } from "./crm";
import { recordOutbound } from "./inbox/store";
import { injectTracking } from "./tracking";
import { randomUUID } from "node:crypto";
import type { SendJob } from "./queue";

/**
 * Shared job processor.
 * Performs the actual send, updates message status in Postgres, and logs the CRM activity.
 */
export async function processSendJob(jobData: SendJob) {
  const { organizationId, channel, leadId, campaignId, templateId, account } = jobData;

  // Scope the lead to the job's organization — never send to another tenant's lead.
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) {
    throw new Error(`[job-processor] lead ${leadId} not found in org ${organizationId}`);
  }

  const tpl = templateId
    ? await prisma.template.findFirst({ where: { id: templateId, organizationId } })
    : null;

  const rendered = tpl
    ? renderMessage(tpl, lead)
    : { body: "", subject: undefined };

  // Pre-generate the Message id so open/click tracking can key on it before sending.
  const messageId = randomUUID();
  const outbound =
    channel === "email" && rendered.body
      ? { subject: rendered.subject, body: injectTracking(rendered.body, messageId) }
      : rendered;

  const result = await safeSend(
    channel,
    {
      id: lead.id,
      email: lead.email,
      phone: lead.phone,
      linkedinUrl: lead.linkedinUrl,
      firstName: lead.firstName,
    },
    outbound,
    account,
    organizationId
  );

  await prisma.message.create({
    data: {
      id: messageId,
      organizationId,
      leadId: lead.id,
      campaignId,
      channel,
      templateId,
      renderedSubject: rendered.subject,
      renderedBody: rendered.body, // store the clean body, not the tracked one
      status: result.ok ? "sent" : result.skipped ? "queued" : "failed",
      providerId: result.providerId,
      idempotencyKey: randomUUID(),
      sentAt: result.ok ? new Date() : null,
    },
  });

  await logActivity({
    organizationId,
    leadId: lead.id,
    campaignId,
    messageId,
    type: result.ok ? "sent" : "failed",
    channel,
    meta: { reason: result.reason, error: result.error },
  });

  // Record the outbound message on the lead's inbox thread so replies thread cleanly.
  if (result.ok && channel === "email" && lead.email) {
    await recordOutbound(organizationId, {
      leadId: lead.id,
      toAddr: lead.email,
      subject: rendered.subject,
      body: rendered.body,
      providerMessageId: result.providerId,
      channel: "email",
    }).catch((e) => console.error("[job-processor] recordOutbound failed:", e));
  }

  // If rate-limited, return a failure indicator so callers can retry (BullMQ or QStash)
  if (!result.ok && result.reason?.startsWith("rate-limited")) {
    throw new Error(result.reason);
  }

  return result;
}
