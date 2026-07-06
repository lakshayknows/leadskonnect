import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, requireDb } from "@/lib/http";
import { logActivity, suppress } from "@/lib/crm";

export const runtime = "nodejs";

/**
 * Twilio WhatsApp status callback (application/x-www-form-urlencoded).
 * TODO: validate the X-Twilio-Signature header before trusting the payload.
 */
export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;

  const form = await req.formData();
  const from = (form.get("From") ?? form.get("WaId") ?? "").toString().replace("whatsapp:", "");
  const status = (form.get("MessageStatus") ?? form.get("SmsStatus") ?? "").toString();
  const body = (form.get("Body") ?? "").toString().trim().toLowerCase();

  if (!from) return ok({ ignored: true });

  const lead = await prisma.lead.findFirst({ where: { phone: { contains: from.slice(-8) } } });

  // Inbound "stop"/"unsubscribe" → suppress (scoped to the matched lead's org)
  if (["stop", "unsubscribe", "stop all"].includes(body) && lead?.organizationId) {
    await suppress(lead.organizationId, { phone: from }, "unsubscribe");
  }

  if (lead) {
    await logActivity({
      organizationId: lead.organizationId,
      leadId: lead.id,
      type: status || (body ? "replied" : "whatsapp_event"),
      channel: "whatsapp",
      meta: { status, body: body || undefined },
    });
  }
  return ok({ processed: true });
}
