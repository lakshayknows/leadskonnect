import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Department } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { requireOrg, requireRole, isDepartmentScoped } from "@/lib/tenant";
import { createPipeline, getBoard, listPipelines } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  // Group leaders/members (PRD §4) only ever see their own department; owner/admin see all.
  const department = (isDepartmentScoped(ctx) ? ctx.department : undefined) as Department | undefined;

  const pipelineId = req.nextUrl.searchParams.get("pipelineId") ?? undefined;
  if (req.nextUrl.searchParams.get("view") === "board") {
    return ok(await getBoard(ctx.orgId, pipelineId, department));
  }

  return ok(await listPipelines(ctx.orgId, department));
}

const Create = z.object({
  department: z.enum(["marketing", "sales", "support", "collections", "recruitment"]),
  name: z.string().trim().min(1).max(60).optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  // Configuring a department's pipeline is a group-leader/admin action.
  const gate = requireRole(ctx, ["owner", "admin", "group_leader"]);
  if (gate) return gate;

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick a department and an optional name.", 422);

  // A group leader can only ever configure their own department's pipeline — override
  // rather than trust whatever department the request body claims.
  let department = parsed.data.department;
  if (ctx.role === "group_leader") {
    if (!ctx.department) return fail("Ask an admin to assign you to a department first.", 403);
    department = ctx.department as Department;
  }

  try {
    return ok(await createPipeline(ctx.orgId, department, { name: parsed.data.name, isDefault: parsed.data.isDefault }));
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("Unique")) return fail("A pipeline with that name already exists.", 409);
    return fail(msg, 400);
  }
}
