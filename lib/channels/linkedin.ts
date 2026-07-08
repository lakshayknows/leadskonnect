import { prisma } from "../db";
import type { Channel, Lead, SendResult } from "./types";
import type { RenderedMessage } from "../templates";
import { enqueueLinkedInAction } from "../linkedin/queue";

/**
 * LinkedIn sending is handled by the companion Chrome extension, not a server API —
 * LinkedIn does not grant invite/DM access through the developer program (see
 * docs/channels.md). A "send" here enqueues a LinkedInAction; the extension, running in
 * the user's own logged-in LinkedIn tab, claims it via /api/linkedin/queue and performs
 * the invite/message with humanized pacing + daily caps.
 */
export const linkedinChannel: Channel = {
  name: "linkedin",
  // Automation is client-side (the extension), so there are no server creds to gate on.
  isConfigured: () => true,

  async send(lead: Lead, rendered: RenderedMessage): Promise<SendResult> {
    if (!lead.linkedinUrl) return { ok: false, skipped: true, reason: "lead has no linkedinUrl" };

    const dbLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { organizationId: true, linkedinUrl: true },
    });
    if (!dbLead?.organizationId) return { ok: false, skipped: true, reason: "lead has no organization" };

    const action = await enqueueLinkedInAction({
      organizationId: dbLead.organizationId,
      leadId: lead.id,
      linkedinUrl: dbLead.linkedinUrl ?? lead.linkedinUrl,
      note: rendered.body || rendered.subject || null,
    });
    return { ok: true, providerId: action.id, reason: "queued for the LinkedIn extension" };
  },
};
