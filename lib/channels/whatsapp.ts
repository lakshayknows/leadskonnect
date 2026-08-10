import { prisma } from "../db";
import { env, configured } from "../env";
import type { Channel, Lead, SendResult, AdapterCapabilities } from "./types";
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

const SESSION_WINDOW_HOURS = 24;

/** Has this lead messaged us on WhatsApp within the free-form session window? Looks at
 *  the unified ConversationEvent timeline (populated on every inbound reply since the
 *  conversation model was unified), not the older InboxThread. */
async function withinSessionWindow(organizationId: string, leadId: string): Promise<boolean> {
  const lastInbound = await prisma.conversationEvent.findFirst({
    where: { organizationId, leadId, channel: "whatsapp", direction: "inbound" },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  if (!lastInbound) return false;
  return Date.now() - lastInbound.occurredAt.getTime() < SESSION_WINDOW_HOURS * 3_600_000;
}

const CAPABILITIES: AdapterCapabilities = {
  send: true,
  receive: true,
  templates: true,
  sessionWindowHours: SESSION_WINDOW_HOURS,
  requiresOptIn: true,
};

export const whatsappChannel: Channel = {
  name: "whatsapp",
  isConfigured: () => configured.whatsapp,
  capabilities: () => CAPABILITIES,

  async send(lead: Lead, rendered: RenderedMessage): Promise<SendResult> {
    if (!configured.whatsapp) return { ok: false, skipped: true, reason: "whatsapp not configured" };
    if (!lead.phone) return { ok: false, skipped: true, reason: "lead has no phone" };

    // Outside the 24h window, Meta/Twilio will reject a free-form message outright —
    // refuse it clearly here rather than let the provider bounce it. Template-based
    // sending outside the window is a follow-up (see WhatsAppTemplate in schema.prisma);
    // this is enforcement of the rule, not template management.
    const dbLead = await prisma.lead.findUnique({ where: { id: lead.id }, select: { organizationId: true } });
    if (dbLead?.organizationId) {
      const live = await withinSessionWindow(dbLead.organizationId, lead.id);
      if (!live) {
        return {
          ok: false,
          skipped: true,
          reason: "outside the 24h WhatsApp session window — needs an approved template, not a free-form send",
        };
      }
    }

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
