/**
 * Next action — the one thing the product promises to remember for you.
 *
 * Every active contact should be able to answer "what do I do next?" without the
 * rep holding it in their head. Two sources feed that answer:
 *
 *   1. An explicit `Task` — a rep scheduled it, or the system created one when a
 *      reply landed.
 *   2. A DERIVED action, computed from state the app already has (an unanswered
 *      inbound message, a breached SLA, a lead nobody has contacted yet).
 *
 * The derivation matters more than it looks: without it the Next Action column is
 * empty on day one for every existing contact, and a CRM whose headline feature is
 * blank until you feed it is the same CRM everyone already abandoned. Derived
 * actions need no setup — they are a reading of the data, not a record.
 */
import { prisma } from "./db";
import type { Prisma, TaskKind, TaskStatus } from "@prisma/client";

/** What the UI renders in a Next Action slot. */
export type NextAction = {
  /** Present only for a real Task — derived actions have nothing to complete. */
  taskId: string | null;
  label: string;
  kind: TaskKind;
  dueAt: Date | null;
  /** Overdue tasks and breached SLAs; drives the red treatment. */
  urgent: boolean;
  /** "task" when a row backs it, otherwise why it was inferred. */
  source: "task" | "reply" | "sla" | "uncontacted";
};

export type TaskScope = "overdue" | "today" | "upcoming" | "done" | "open";

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function createTask(input: {
  organizationId: string;
  leadId?: string | null;
  pipelineItemId?: string | null;
  title: string;
  kind?: TaskKind;
  dueAt?: Date | null;
  ownerId?: string | null;
  createdBy?: string | null;
  createdKind?: "user" | "ai" | "system";
}) {
  return prisma.task.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId ?? null,
      pipelineItemId: input.pipelineItemId ?? null,
      title: input.title,
      kind: input.kind ?? "follow_up",
      dueAt: input.dueAt ?? null,
      ownerId: input.ownerId ?? null,
      createdBy: input.createdBy ?? null,
      createdKind: input.createdKind ?? "user",
    },
  });
}

/** Scoped by org in the WHERE, so a foreign id can never be completed. */
export async function completeTask(organizationId: string, taskId: string) {
  const res = await prisma.task.updateMany({
    where: { id: taskId, organizationId },
    data: { status: "done", completedAt: new Date() },
  });
  return res.count > 0;
}

export async function reopenTask(organizationId: string, taskId: string) {
  const res = await prisma.task.updateMany({
    where: { id: taskId, organizationId },
    data: { status: "open", completedAt: null },
  });
  return res.count > 0;
}

export async function updateTask(
  organizationId: string,
  taskId: string,
  data: { title?: string; kind?: TaskKind; dueAt?: Date | null; ownerId?: string | null; status?: TaskStatus },
) {
  const res = await prisma.task.updateMany({ where: { id: taskId, organizationId }, data });
  return res.count > 0;
}

export async function deleteTask(organizationId: string, taskId: string) {
  const res = await prisma.task.deleteMany({ where: { id: taskId, organizationId } });
  return res.count > 0;
}

/**
 * Create a follow-up for an inbound reply — unless one is already open.
 *
 * Called from the conversation recorder, which every channel writes through, so
 * a WhatsApp reply and an email reply both produce a task without either adapter
 * knowing tasks exist. Idempotent by design: a chatty contact sending five
 * messages should produce one thing to do, not five.
 */
export async function ensureReplyFollowUp(args: {
  organizationId: string;
  leadId: string;
  channel: string;
}): Promise<void> {
  const open = await prisma.task.findFirst({
    where: { organizationId: args.organizationId, leadId: args.leadId, status: "open" },
    select: { id: true },
  });
  if (open) return;

  const lead = await prisma.lead.findFirst({
    where: { id: args.leadId, organizationId: args.organizationId },
    select: { firstName: true, lastName: true, email: true },
  });
  const who = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || lead?.email || "this contact";

  // Ownership follows the pipeline item — whoever owns the deal owns the reply.
  const item = await prisma.pipelineItem.findFirst({
    where: { organizationId: args.organizationId, leadId: args.leadId, closedAt: null },
    select: { id: true, ownerId: true },
  });

  await createTask({
    organizationId: args.organizationId,
    leadId: args.leadId,
    pipelineItemId: item?.id ?? null,
    title: `Reply to ${who}`,
    kind: channelToKind(args.channel),
    // Due now: a reply that has been sitting unanswered is already the work.
    dueAt: new Date(),
    ownerId: item?.ownerId ?? null,
    createdKind: "system",
  });
}

function channelToKind(channel: string): TaskKind {
  switch (channel) {
    case "email": return "email";
    case "whatsapp": return "whatsapp";
    case "linkedin": return "linkedin";
    default: return "follow_up";
  }
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function scopeWhere(scope: TaskScope): Prisma.TaskWhereInput {
  switch (scope) {
    case "overdue":
      return { status: "open", dueAt: { lt: startOfToday() } };
    case "today":
      // An undated open task is work you accepted with no deadline — it belongs
      // in Today rather than nowhere, or it is never seen again.
      return { status: "open", OR: [{ dueAt: { gte: startOfToday(), lte: endOfToday() } }, { dueAt: null }] };
    case "upcoming":
      return { status: "open", dueAt: { gt: endOfToday() } };
    case "done":
      return { status: "done" };
    case "open":
      return { status: "open" };
  }
}

const TASK_SELECT = {
  id: true,
  leadId: true,
  title: true,
  kind: true,
  status: true,
  dueAt: true,
  ownerId: true,
  createdKind: true,
  completedAt: true,
  createdAt: true,
  lead: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
} satisfies Prisma.TaskSelect;

export type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

export async function listTasks(
  organizationId: string,
  opts: { scope?: TaskScope; ownerId?: string; leadId?: string; limit?: number } = {},
): Promise<TaskRow[]> {
  const { scope = "open", ownerId, leadId, limit = 200 } = opts;
  return prisma.task.findMany({
    where: {
      organizationId,
      ...scopeWhere(scope),
      ...(ownerId ? { ownerId } : {}),
      ...(leadId ? { leadId } : {}),
    },
    // Nulls last so dated work leads; done tasks read newest-first instead.
    orderBy: scope === "done" ? { completedAt: "desc" } : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: limit,
    select: TASK_SELECT,
  });
}

/** The four buckets the Tasks screen renders, in one round of queries. */
export async function getTaskBuckets(organizationId: string, ownerId?: string) {
  const [overdue, today, upcoming, done] = await Promise.all([
    listTasks(organizationId, { scope: "overdue", ownerId }),
    listTasks(organizationId, { scope: "today", ownerId }),
    listTasks(organizationId, { scope: "upcoming", ownerId }),
    listTasks(organizationId, { scope: "done", ownerId, limit: 25 }),
  ]);
  return { overdue, today, upcoming, done };
}

export function taskLabel(t: { title: string; dueAt: Date | null }): string {
  if (!t.dueAt) return t.title;
  const due = new Date(t.dueAt);
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const time = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (due < today) return `${t.title} · overdue`;
  if (due <= endOfToday()) return `${t.title} · today ${time}`;
  if (due < new Date(tomorrow.getTime() + 86_400_000)) return `${t.title} · tomorrow ${time}`;
  return `${t.title} · ${due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

/**
 * Next action for many contacts at once.
 *
 * Batched deliberately: the leads table renders this column for 50 rows, and a
 * per-row query would be 50 round trips for one screen. Four bounded queries
 * serve any page size instead.
 */
export async function nextActionsFor(
  organizationId: string,
  leadIds: string[],
): Promise<Map<string, NextAction>> {
  const out = new Map<string, NextAction>();
  if (leadIds.length === 0) return out;

  const [tasks, events, items, leads] = await Promise.all([
    prisma.task.findMany({
      where: { organizationId, leadId: { in: leadIds }, status: "open" },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      select: { id: true, leadId: true, title: true, kind: true, dueAt: true },
    }),
    // No `distinct on` in the Prisma client — pull recent events and reduce to
    // one per lead in JS. Capped, since this only needs the latest per contact.
    prisma.conversationEvent.findMany({
      where: { organizationId, leadId: { in: leadIds } },
      orderBy: { occurredAt: "desc" },
      take: Math.min(leadIds.length * 4, 2000),
      select: { leadId: true, direction: true, channel: true, occurredAt: true },
    }),
    prisma.pipelineItem.findMany({
      where: { organizationId, leadId: { in: leadIds }, closedAt: null },
      select: { leadId: true, slaBreachedAt: true, stage: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: { organizationId, id: { in: leadIds } },
      select: { id: true, stage: true, optedOut: true },
    }),
  ]);

  const firstTaskByLead = new Map<string, (typeof tasks)[number]>();
  for (const t of tasks) if (t.leadId && !firstTaskByLead.has(t.leadId)) firstTaskByLead.set(t.leadId, t);

  const latestByLead = new Map<string, (typeof events)[number]>();
  const hasOutbound = new Set<string>();
  for (const e of events) {
    if (!latestByLead.has(e.leadId)) latestByLead.set(e.leadId, e);
    if (e.direction === "outbound") hasOutbound.add(e.leadId);
  }

  const itemByLead = new Map(items.map((i) => [i.leadId, i]));
  const now = Date.now();

  for (const lead of leads) {
    // An opted-out contact has exactly one correct next action: none.
    if (lead.optedOut) continue;

    // 1. A real task always wins — someone decided this on purpose.
    const task = firstTaskByLead.get(lead.id);
    if (task) {
      out.set(lead.id, {
        taskId: task.id,
        label: taskLabel(task),
        kind: task.kind,
        dueAt: task.dueAt,
        urgent: !!task.dueAt && task.dueAt.getTime() <= now,
        source: "task",
      });
      continue;
    }

    // 2. They spoke last and nobody answered.
    const latest = latestByLead.get(lead.id);
    if (latest?.direction === "inbound") {
      out.set(lead.id, {
        taskId: null,
        label: "Reply now",
        kind: channelToKind(latest.channel),
        dueAt: null,
        urgent: true,
        source: "reply",
      });
      continue;
    }

    // 3. Sitting past its stage SLA.
    const item = itemByLead.get(lead.id);
    if (item?.slaBreachedAt) {
      out.set(lead.id, {
        taskId: null,
        label: `Overdue in ${item.stage.name}`,
        kind: "follow_up",
        dueAt: null,
        urgent: true,
        source: "sla",
      });
      continue;
    }

    // 4. Never contacted at all.
    if (lead.stage === "new" && !hasOutbound.has(lead.id)) {
      out.set(lead.id, {
        taskId: null,
        label: "Contact",
        kind: "follow_up",
        dueAt: null,
        urgent: false,
        source: "uncontacted",
      });
    }
    // Otherwise: nothing owed. The UI shows "Waiting" for an absent entry.
  }

  return out;
}

/** Single-contact convenience for the lead detail page. */
export async function nextActionFor(organizationId: string, leadId: string): Promise<NextAction | null> {
  const map = await nextActionsFor(organizationId, [leadId]);
  return map.get(leadId) ?? null;
}
