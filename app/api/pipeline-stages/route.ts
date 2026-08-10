import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requireOrg, requireRole } from "@/lib/tenant";
import { addStage, updateStage, deleteStage, StageHasItems } from "@/lib/pipeline";

export const runtime = "nodejs";

const StageKind = z.enum(["open", "won", "lost"]);

const Add = z.object({
  pipelineId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  kind: StageKind.optional(),
  slaHours: z.number().int().min(1).max(24 * 365).nullable().optional(),
  atPosition: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const gate = requireRole(ctx, ["owner", "admin", "group_leader"]);
  if (gate) return gate;

  const parsed = Add.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("pipelineId and name are required.", 422);

  try {
    return ok(await addStage({ organizationId: ctx.orgId, ...parsed.data }));
  } catch (e) {
    return fail((e as Error).message, 400);
  }
}

const Patch = z.object({
  stageId: z.string().min(1),
  name: z.string().trim().min(1).max(60).optional(),
  kind: StageKind.optional(),
  slaHours: z.number().int().min(1).max(24 * 365).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export async function PATCH(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const gate = requireRole(ctx, ["owner", "admin", "group_leader"]);
  if (gate) return gate;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("stageId is required.", 422);

  try {
    return ok(await updateStage({ organizationId: ctx.orgId, ...parsed.data }));
  } catch (e) {
    return fail((e as Error).message, 400);
  }
}

const Delete = z.object({ stageId: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const gate = requireRole(ctx, ["owner", "admin", "group_leader"]);
  if (gate) return gate;

  const parsed = Delete.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("stageId is required.", 422);

  try {
    await deleteStage({ organizationId: ctx.orgId, stageId: parsed.data.stageId });
    return ok({ deleted: true });
  } catch (e) {
    // 422 rather than 400: the request is well-formed, the stage just isn't empty yet.
    if (e instanceof StageHasItems) return fail(e.message, 422);
    return fail((e as Error).message, 400);
  }
}
