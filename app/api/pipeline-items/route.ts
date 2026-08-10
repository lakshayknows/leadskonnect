import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { addToPipeline, moveToStage, BackwardMoveNeedsReason } from "@/lib/pipeline";

export const runtime = "nodejs";

const Add = z.object({ pipelineId: z.string().min(1), leadId: z.string().min(1), ownerId: z.string().optional() });

export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = Add.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("pipelineId and leadId are required.", 422);
  return ok(await addToPipeline({ organizationId: ctx.orgId, ...parsed.data }));
}

const Move = z.object({
  itemId: z.string().min(1),
  toStageId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
  actorKind: z.enum(["user", "ai", "system"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const parsed = Move.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("itemId and toStageId are required.", 422);

  try {
    return ok(
      await moveToStage({
        organizationId: ctx.orgId,
        actorId: ctx.userId,
        ...parsed.data,
      }),
    );
  } catch (e) {
    // 422 rather than 400: the request is well-formed, it just needs a reason.
    if (e instanceof BackwardMoveNeedsReason) return fail(e.message, 422);
    return fail((e as Error).message, 400);
  }
}
