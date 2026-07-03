import { env, configured } from "../env";
import type { Channel, Lead, SendResult } from "./types";
import type { RenderedMessage } from "../templates";

let client: import("twilio").Twilio | null = null;

async function getClient() {
  if (client) return client;
  const twilio = (await import("twilio")).default;
  client = twilio(env.twilio.accountSid!, env.twilio.authToken!);
  return client;
}

function toWhatsAppAddress(phone: string): string {
  const clean = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
  return clean;
}

export const whatsappChannel: Channel = {
  name: "whatsapp",
  isConfigured: () => configured.whatsapp,

  async send(lead: Lead, rendered: RenderedMessage): Promise<SendResult> {
    if (!configured.whatsapp) return { ok: false, skipped: true, reason: "whatsapp not configured" };
    if (!lead.phone) return { ok: false, skipped: true, reason: "lead has no phone" };
    // NOTE: outside the 24h window this body MUST correspond to a Meta-approved
    // template, and the recipient MUST have opted in. See docs/channels.md.
    try {
      const c = await getClient();
      const msg = await c.messages.create({
        from: toWhatsAppAddress(env.twilio.whatsappFrom!),
        to: toWhatsAppAddress(lead.phone),
        body: rendered.body,
      });
      return { ok: true, providerId: msg.sid };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
