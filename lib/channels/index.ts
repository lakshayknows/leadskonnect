import { emailChannel } from "./email";
import { whatsappChannel } from "./whatsapp";
import { linkedinChannel } from "./linkedin";
import { socialChannel } from "./social";
import type { Channel, Lead, SendResult } from "./types";
import type { RenderedMessage } from "../templates";
import { acquire } from "../ratelimit";
import { isSuppressed } from "../crm";

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

  const quota = await acquire(channelName, account, orgId);
  if (!quota.ok) {
    return {
      ok: false,
      skipped: true,
      reason: `rate-limited; retry in ${Math.ceil(quota.retryAfterMs / 1000)}s`,
    };
  }

  return channel.send(lead, rendered, account);
}
