import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { getOrCreateAccount, genToken } from "@/lib/linkedin/auth";
import { queueStats } from "@/lib/linkedin/queue";

export const runtime = "nodejs";

// GET — this member's LinkedIn extension status, token, caps, and live queue counts.
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const account = await getOrCreateAccount(ctx.orgId, ctx.userId);
  const stats = await queueStats(ctx.orgId);
  return ok({
    extToken: account.extToken,
    status: account.status,
    liMemberName: account.liMemberName,
    lastSeenAt: account.lastSeenAt,
    dailyInviteCap: account.dailyInviteCap,
    minDelaySec: account.minDelaySec,
    maxDelaySec: account.maxDelaySec,
    queue: stats,
  });
}

const Body = z.object({
  action: z.enum(["rotate", "update"]),
  dailyInviteCap: z.number().int().min(1).max(50).optional(),
  minDelaySec: z.number().int().min(10).max(600).optional(),
  maxDelaySec: z.number().int().min(15).max(900).optional(),
});

// POST — rotate the token or update caps/pacing.
export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");

  const account = await getOrCreateAccount(ctx.orgId, ctx.userId);
  const data: Record<string, unknown> = {};
  if (parsed.data.action === "rotate") {
    data.extToken = genToken();
    data.status = "pending";
    data.liMemberName = null;
  }
  if (parsed.data.dailyInviteCap !== undefined) data.dailyInviteCap = parsed.data.dailyInviteCap;
  if (parsed.data.minDelaySec !== undefined) data.minDelaySec = parsed.data.minDelaySec;
  if (parsed.data.maxDelaySec !== undefined) data.maxDelaySec = parsed.data.maxDelaySec;

  const updated = await prisma.linkedInAccount.update({ where: { id: account.id }, data });
  return ok({ extToken: updated.extToken, status: updated.status, dailyInviteCap: updated.dailyInviteCap, minDelaySec: updated.minDelaySec, maxDelaySec: updated.maxDelaySec });
}
