import { emailChannel } from "./email";
import { whatsappChannel } from "./whatsapp";
import { linkedinChannel } from "./linkedin";
import { socialChannel } from "./social";
import type { Channel, Lead, SendResult } from "./types";
import type { RenderedMessage } from "../templates";
import { acquire } from "../ratelimit";
import { isSuppressed } from "../crm";
import { recordConversationEvent } from "../conversation";
import { isQuietHours } from "../quiet-hours";

export const channels: Record<Channel["name"], Channel> = {
  email: emailChannel,
  whatsapp: whatsappChannel,
  linkedin: linkedinChannel,
  social: socialChannel,
};

export type { Channel, Lead, SendResult };

/**
 * Safe send: enforces suppression + rate limit before delegating to the channel.
 * This is the ONLY function callers (API routes, worker, agent) should use.
 */
export async function safeSend(
  channelName: Channel["name"],
  lead: Lead,
  rendered: RenderedMessage,
  account = "default",
  orgId = "global"
): Promise<SendResult> {
  const channel = channels[channelName];

  if (await isSuppressed(orgId, { email: lead.email, phone: lead.phone, linkedinUrl: lead.linkedinUrl })) {
    return { ok: false, skipped: true, reason: "suppressed" };
  }

  if (channelName === "whatsapp" && isQuietHours(lead.phone)) {
    return { ok: false, skipped: true, reason: "quiet hours at the contact's estimated local time" };
  }

  const quota = await acquire(channelName, account, orgId);
  if (!quota.ok) {
    return {
      ok: false,
      skipped: true,
      reason: `rate-limited; retry in ${Math.ceil(quota.retryAfterMs / 1000)}s`,
    };
  }

  const result = await channel.send(lead, rendered, account);

  // LinkedIn's "ok" here means "queued for the extension to draft," not "a human actually
  // sent it" — that confirmation writes its own ConversationEvent later, from
  // lib/linkedin/queue.ts::completeAction, once the person clicks "I sent it."
  if (result.ok && !result.skipped && channelName !== "linkedin") {
    await recordConversationEvent({
      organizationId: orgId,
      leadId: lead.id,
      channel: channelName,
      direction: "outbound",
      subject: rendered.subject ?? null,
      body: rendered.body ?? null,
      status: "sent",
      externalId: result.providerId ?? null,
    });
  }

  return result;
}
