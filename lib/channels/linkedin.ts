import { configured } from "../env";
import type { Channel, Lead, SendResult } from "./types";
import type { RenderedMessage } from "../templates";

/**
 * LinkedIn is a gray area for personal-account automation (see docs/channels.md).
 * This module intentionally does NOT ship browser automation by default. Two paths:
 *
 *   1. Official API (org pages) — wire LINKEDIN_ACCESS_TOKEN and call the REST API.
 *   2. Browser automation (personal) — implement `sendViaBrowser` with Puppeteer/
 *      Playwright using LINKEDIN_LI_AT, with humanized delays. Opt-in, at your own risk.
 *
 * Until one is implemented, sends are reported as skipped so campaigns don't fail.
 */
export const linkedinChannel: Channel = {
  name: "linkedin",
  isConfigured: () => configured.linkedin,

  async send(lead: Lead, _rendered: RenderedMessage): Promise<SendResult> {
    if (!configured.linkedin) {
      return { ok: false, skipped: true, reason: "linkedin not configured" };
    }
    if (!lead.linkedinUrl) {
      return { ok: false, skipped: true, reason: "lead has no linkedinUrl" };
    }
    // TODO: implement official API invite/message or browser automation.
    return {
      ok: false,
      skipped: true,
      reason: "linkedin send not implemented — see lib/channels/linkedin.ts",
    };
  },
};
