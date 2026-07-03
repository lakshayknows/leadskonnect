import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, requireDb } from "@/lib/http";
import { suppress, logActivity } from "@/lib/crm";

export const runtime = "nodejs";

/**
 * Email provider webhook (bounces / complaints / opens). Shape varies by provider
 * (SendGrid/Mailgun/SES) — normalize `event`, `email`, `messageId` before use.
 * TODO: verify the provider signature before trusting the payload.
 */
export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;

  const events = await req.json().catch(() => []);
  const list = Array.isArray(events) ? events : [events];

  for (const e of list) {
    const email = e.email ?? e.recipient;
    const event = (e.event ?? e.type ?? "").toLowerCase();
    if (!email) continue;

    if (event.includes("bounce") || event.includes("complaint") || event.includes("spam")) {
      await suppress({ email }, event.includes("bounce") ? "bounce" : "unsubscribe");
    }

    const lead = await prisma.lead.findUnique({ where: { email } });
    if (lead) {
      await logActivity({
        leadId: lead.id,
        type: event || "email_event",
        channel: "email",
        meta: e,
      });
    }
  }
  return ok({ processed: list.length });
}
