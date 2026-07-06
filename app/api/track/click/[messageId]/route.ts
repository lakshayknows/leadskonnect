import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/crm";
import { env } from "@/lib/env";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ messageId: string }> };

// GET /api/track/click/[messageId]?u=<encoded url> — records a click, then 302s to the URL.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { messageId } = await params;
  const target = req.nextUrl.searchParams.get("u");

  // Validate the destination is an http(s) URL; fall back to the app home if not.
  let dest = env.appUrl;
  try {
    if (target) {
      const u = new URL(target);
      if (u.protocol === "http:" || u.protocol === "https:") dest = target;
    }
  } catch {
    /* keep fallback */
  }

  try {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (message?.organizationId) {
      await logActivity({
        organizationId: message.organizationId,
        leadId: message.leadId,
        campaignId: message.campaignId ?? undefined,
        messageId,
        type: "clicked",
        channel: message.channel,
        meta: { url: target ?? undefined },
      });
      if (message.status === "sent") {
        await prisma.message.update({ where: { id: messageId }, data: { status: "delivered" } });
      }
    }
  } catch {
    // Redirect regardless — never trap the recipient.
  }

  return NextResponse.redirect(dest, { status: 302 });
}
