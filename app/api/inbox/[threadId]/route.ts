import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { safeSend } from "@/lib/channels";
import { recordOutbound } from "@/lib/inbox/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ threadId: string }> };

// GET a thread with its full message history.
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { threadId } = await params;
  const thread = await prisma.inboxThread.findFirst({
    where: { id: threadId, organizationId: ctx.orgId },
    include: { lead: true, messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!thread) return fail("not found", 404);
  return ok(thread);
}

const Patch = z.object({ status: z.enum(["unread", "read", "interested", "not_interested", "ooo"]) });

// PATCH status (triage: read / interested / not interested / OOO).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { threadId } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid status");
  const res = await prisma.inboxThread.updateMany({
    where: { id: threadId, organizationId: ctx.orgId },
    data: { status: parsed.data.status },
  });
  if (res.count === 0) return fail("not found", 404);
  return ok({ status: parsed.data.status });
}

const Reply = z.object({ body: z.string().min(1), subject: z.string().optional() });

// POST a reply — sends an email to the lead and records it on the thread.
export async function POST(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { threadId } = await params;
  const parsed = Reply.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("expected { body, subject? }");

  const thread = await prisma.inboxThread.findFirst({
    where: { id: threadId, organizationId: ctx.orgId },
    include: { lead: true },
  });
  if (!thread) return fail("not found", 404);
  if (!thread.lead?.email) return fail("thread has no lead email to reply to", 400);

  // Prefer the org's first active sending account, else the env default.
  const account = await prisma.sendingAccount.findFirst({
    where: { organizationId: ctx.orgId, active: true },
    orderBy: { createdAt: "asc" },
  });

  const subject = parsed.data.subject ?? (thread.subject ? `Re: ${thread.subject}` : "Re:");
  const result = await safeSend(
    "email",
    { id: thread.lead.id, email: thread.lead.email, firstName: thread.lead.firstName },
    { subject, body: parsed.data.body },
    account?.id ?? "default",
    ctx.orgId
  );

  if (!result.ok) return fail(result.reason || result.error || "send failed", 400);

  await recordOutbound(ctx.orgId, {
    leadId: thread.lead.id,
    toAddr: thread.lead.email,
    subject,
    body: parsed.data.body,
    providerMessageId: result.providerId,
    channel: "email",
  });
  await prisma.inboxThread.update({ where: { id: thread.id }, data: { status: "read" } });

  return ok({ sent: true });
}
