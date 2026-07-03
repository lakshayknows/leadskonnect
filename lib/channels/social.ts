import type { Channel, Lead, SendResult } from "./types";
import type { RenderedMessage } from "../templates";

/**
 * Social commenting (LinkedIn/Twitter/Facebook/Instagram). Each platform needs its
 * own OAuth app + rate limits (see docs/channels.md). Not wired by default — provide
 * per-platform tokens and implement the specific API call you need.
 */
export const socialChannel: Channel = {
  name: "social",
  isConfigured: () => false,

  async send(_lead: Lead, _rendered: RenderedMessage): Promise<SendResult> {
    return {
      ok: false,
      skipped: true,
      reason: "social send not implemented — see lib/channels/social.ts",
    };
  },
};
