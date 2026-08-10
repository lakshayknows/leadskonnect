import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { safeSend } from "@/lib/channels";
import { logActivity } from "@/lib/crm";

export const runtime = "nodejs";

// GET /api/agent/drafts — messages the agent wrote but wasn't confident enough to send
// unattended (product PRD §7: confidence-gated autonomy), awaiting human approval.
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const drafts = await prisma.message.findMany({
    where: { organizationId: ctx.orgId, status: "draft" },
    orderBy: { createdAt: "desc" },
    include: { lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, linkedinUrl: true } } },
  });
  return ok(drafts);
}

const Patch = z.object({ messageId: z.string().min(1), action: z.enum(["approve", "discard"]) });

// PATCH /api/agent/drafts — approve (actually send it, same path as every other send)
// or discard (nothing was ever sent, so there's nothing to keep a record of).
export async function PATCH(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("messageId and action are required.", 422);

  const draft = await prisma.message.findFirst({
    where: { id: parsed.data.messageId, organizationId: ctx.orgId, status: "draft" },
    include: { lead: true },
  });
  if (!draft) return fail("Draft not found.", 404);

  if (parsed.data.action === "discard") {
    await prisma.message.delete({ where: { id: draft.id } });
    return ok({ discarded: true });
  }

  const result = await safeSend(
    draft.channel,
    { id: draft.lead.id, email: draft.lead.email, phone: draft.lead.phone, linkedinUrl: draft.lead.linkedinUrl, firstName: draft.lead.firstName },
    { subject: draft.renderedSubject ?? undefined, body: draft.renderedBody ?? "" },
    "default",
    ctx.orgId,
  );

  const updated = await prisma.message.update({
    where: { id: draft.id },
    data: {
      status: result.ok ? "sent" : result.skipped ? "queued" : "failed",
      providerId: result.providerId,
      sentAt: result.ok ? new Date() : null,
    },
  });
  await logActivity({
    organizationId: ctx.orgId,
    leadId: draft.lead.id,
    type: result.ok ? "sent" : "failed",
    channel: draft.channel,
    meta: { reason: result.reason, approvedBy: ctx.userId },
  });
  return ok(updated);
}
