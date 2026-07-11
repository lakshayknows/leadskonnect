import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireExtAuth } from "@/lib/linkedin/auth";
import { claimActions, completeAction } from "@/lib/linkedin/queue";
import { corsPreflight, withCors } from "@/lib/linkedin/cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return corsPreflight();
}

// GET — extension polls for its next batch of actions (marks them in_progress).
export async function GET(req: NextRequest) {
  const account = await requireExtAuth(req);
  if (account instanceof Response) return withCors(account);

  await prisma.linkedInAccount.update({
    where: { id: account.id },
    data: { lastSeenAt: new Date(), status: "connected" },
  });

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 3), 1), 10);
  const actions = await claimActions(account, limit);

  return withCors(
    ok({
      pacing: { minDelaySec: account.minDelaySec, maxDelaySec: account.maxDelaySec },
      mode: account.mode,
      actions: actions.map((a) => ({ id: a.id, type: a.type, linkedinUrl: a.linkedinUrl, note: a.note })),
    })
  );
}

const Report = z.object({
  actionId: z.string(),
  status: z.enum(["sent", "failed", "skipped"]),
  result: z.string().optional(),
  liMemberName: z.string().optional(),
});

// POST — extension reports the outcome of an action.
export async function POST(req: NextRequest) {
  const account = await requireExtAuth(req);
  if (account instanceof Response) return withCors(account);

  const parsed = Report.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(fail("expected { actionId, status }"));

  if (parsed.data.liMemberName && parsed.data.liMemberName !== account.liMemberName) {
    await prisma.linkedInAccount.update({ where: { id: account.id }, data: { liMemberName: parsed.data.liMemberName } }).catch(() => {});
  }

  const updated = await completeAction(account.organizationId, parsed.data);
  if (!updated) return withCors(fail("action not found", 404));
  return withCors(ok({ ok: true }));
}
