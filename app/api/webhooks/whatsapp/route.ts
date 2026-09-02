import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, requireDb } from "@/lib/http";
import { logActivity, suppress } from "@/lib/crm";
import { env } from "@/lib/env";
import { verifyTwilioSignature } from "@/lib/webhook-auth";

export const runtime = "nodejs";

/**
 * Twilio WhatsApp webhook (application/x-www-form-urlencoded).
 *
 * Carries two unrelated things on one endpoint: delivery *status* callbacks for
 * messages we sent, and genuine *inbound* messages from a contact. They are
 * handled separately — treating them as one is how a "delivered" callback used
 * to overwrite a real reply.
 *
 * Signed by Twilio; unsigned requests are rejected. Before that check existed,
 * anyone could POST `Body=stop` and unsubscribe another workspace's contacts.
 */
export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = v.toString();

  // Twilio signs the URL it was configured with, which is the public app URL —
  // behind Vercel's proxy req.url can be an internal hostname.
  const signedUrl = `${env.appUrl.replace(/\/$/, "")}/api/webhooks/whatsapp`;
  if (!verifyTwilioSignature(req.headers.get("x-twilio-signature"), signedUrl, params, env.twilio.authToken)) {
    return fail("Invalid signature.", 401);
  }

  const from = (params.From ?? params.WaId ?? "").replace("whatsapp:", "");
  const status = params.MessageStatus ?? params.SmsStatus ?? "";
  const body = (params.Body ?? "").trim();
  if (!from) return ok({ ignored: true });

  const lead = await prisma.lead.findFirst({ where: { phone: { contains: from.slice(-8) } } });
  if (!lead?.organizationId) return ok({ processed: true, matched: false });

  const orgId = lead.organizationId;

  // An inbound message carries a Body; a status callback does not. This is the
  // distinction that keeps a delivery receipt from being logged as a reply.
  const isInbound = body.length > 0;

  if (isInbound && ["stop", "unsubscribe", "stop all"].includes(body.toLowerCase())) {
    await suppress(orgId, { phone: from }, "unsubscribe");
  }

  await logActivity({
    organizationId: orgId,
    leadId: lead.id,
    type: isInbound ? "replied" : status || "whatsapp_event",
    channel: "whatsapp",
    meta: { status: status || undefined, body: isInbound ? body : undefined },
  });

  return ok({ processed: true, kind: isInbound ? "inbound" : "status" });
}
