import type { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { env, configured } from "@/lib/env";

export const runtime = "nodejs";

/** Last 4 digits only — this is an authenticated route, but no reason to expose the
 *  full sending number to every member who can view Settings. */
function maskPhone(phone: string): string {
  const digits = phone.replace(/^whatsapp:/, "");
  return digits.length > 4 ? `••• ${digits.slice(-4)}` : digits;
}

// GET /api/channels/status — WhatsApp/SMS business-channel config, for the settings
// screen. Credentials themselves stay in env vars (CLAUDE.md: secrets never move into the
// database from a settings UI) — this only ever reports status + a masked identifier.
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  return ok({
    whatsapp: {
      configured: configured.whatsapp,
      fromMasked: env.twilio.whatsappFrom ? maskPhone(env.twilio.whatsappFrom) : null,
    },
    sms: {
      // Deliberately unbuilt — DLT registration is an external, days-to-weeks process
      // (dev PRD §3.9), not something code can stand up. See docs/channels.md.
      configured: false,
    },
  });
}
