import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { getOnboardingState, TOUR_VERSION } from "@/lib/queries";

export const runtime = "nodejs";

const Body = z.object({
  action: z.enum(["start", "step", "complete", "skip", "restart", "theme", "dismiss-checklist"]),
  step: z.number().int().min(0).max(50).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok(await getOnboardingState(ctx.userId));
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request body.", 422);
  const { action, step, theme } = parsed.data;

  // Scoped by userId, not orgId: onboarding is per-person, so someone who
  // belongs to two workspaces doesn't get the tour again in the second one.
  const where = { id: ctx.userId };

  switch (action) {
    case "start":
      await prisma.user.update({ where, data: { onboardingStep: 0 } });
      break;
    case "step":
      if (step === undefined) return fail("`step` is required for this action.", 422);
      await prisma.user.update({ where, data: { onboardingStep: step } });
      break;
    case "complete":
      await prisma.user.update({
        where,
        data: { onboardingCompletedAt: new Date(), onboardingSkippedAt: null, tourVersion: TOUR_VERSION },
      });
      break;
    case "skip":
      await prisma.user.update({
        where,
        data: { onboardingSkippedAt: new Date(), tourVersion: TOUR_VERSION },
      });
      break;
    case "restart":
      await prisma.user.update({
        where,
        data: { onboardingCompletedAt: null, onboardingSkippedAt: null, onboardingStep: 0 },
      });
      break;
    case "theme":
      if (!theme) return fail("`theme` is required for this action.", 422);
      await prisma.user.update({ where, data: { themePreference: theme } });
      break;
    case "dismiss-checklist":
      await prisma.user.update({
        where,
        data: { checklistState: { dismissedAt: new Date().toISOString() } },
      });
      break;
  }

  return ok(await getOnboardingState(ctx.userId));
}
