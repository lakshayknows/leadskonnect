import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { createTask, completeTask, reopenTask, updateTask, deleteTask, getTaskBuckets, listTasks } from "@/lib/tasks";

export const runtime = "nodejs";

const SCOPES = ["overdue", "today", "upcoming", "done", "open"] as const;

/** The first failing field, named — zod's default path is more useful than a generic string. */
function issueMessage(err: z.ZodError, fallback: string): string {
  const i = err.issues[0];
  if (!i) return fallback;
  const field = i.path.join(".");
  return field ? `${field}: ${i.message}` : i.message;
}

/**
 * GET /api/tasks
 *   ?view=buckets            → { overdue, today, upcoming, done } (the Tasks screen)
 *   ?scope=today&leadId=…    → a single flat list
 *   ?mine=1                  → restrict to the caller's own tasks
 */
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const ownerId = url.searchParams.get("mine") ? ctx.userId : undefined;
  const leadId = url.searchParams.get("leadId") ?? undefined;

  if (url.searchParams.get("view") === "buckets") {
    return ok(await getTaskBuckets(ctx.orgId, ownerId));
  }

  const raw = url.searchParams.get("scope") ?? "open";
  const scope = (SCOPES as readonly string[]).includes(raw) ? (raw as (typeof SCOPES)[number]) : "open";
  return ok(await listTasks(ctx.orgId, { scope, ownerId, leadId }));
}

const Create = z.object({
  title: z.string().trim().min(1).max(200),
  leadId: z.string().min(1).optional(),
  pipelineItemId: z.string().min(1).optional(),
  kind: z.enum(["follow_up", "call", "email", "whatsapp", "linkedin", "meeting", "other"]).optional(),
  // Accepts an ISO string; null/absent means "no deadline", which is a real choice.
  dueAt: z.string().datetime().nullable().optional(),
  ownerId: z.string().min(1).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const parsed = Create.safeParse(await req.json().catch(() => null));
  // Report the field that actually failed — "a title is required" when the date was
  // malformed sends the caller looking in the wrong place.
  if (!parsed.success) return fail(issueMessage(parsed.error, "A title is required."), 422);
  const { dueAt, ownerId, ...rest } = parsed.data;

  const task = await createTask({
    organizationId: ctx.orgId,
    ...rest,
    dueAt: dueAt ? new Date(dueAt) : null,
    // Unassigned tasks are invisible work — default them to whoever made it.
    ownerId: ownerId === undefined ? ctx.userId : ownerId,
    createdBy: ctx.userId,
    createdKind: "user",
  });
  return ok(task);
}

const Patch = z.object({
  id: z.string().min(1),
  action: z.enum(["complete", "reopen", "update"]).default("update"),
  title: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(["follow_up", "call", "email", "whatsapp", "linkedin", "meeting", "other"]).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  ownerId: z.string().min(1).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(issueMessage(parsed.error, "A task id is required."), 422);
  const { id, action, dueAt, ...rest } = parsed.data;

  const done =
    action === "complete"
      ? await completeTask(ctx.orgId, id)
      : action === "reopen"
        ? await reopenTask(ctx.orgId, id)
        : await updateTask(ctx.orgId, id, {
            ...rest,
            ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
          });

  if (!done) return fail("Task not found.", 404);
  return ok({ id, action });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("A task id is required.", 422);
  if (!(await deleteTask(ctx.orgId, id))) return fail("Task not found.", 404);
  return ok({ deleted: true });
}
