/**
 * Generic pipeline engine.
 *
 * One set of mechanics — ordered stages, per-stage SLA timers, drag-drop moves,
 * mandatory reason capture on backward moves, escalation up the org hierarchy —
 * that every department configures for itself. Built once, so adding Support or
 * Collections is a configuration change, not another pipeline implementation.
 */
import { prisma } from "./db";
import type { Department, StageKind } from "@prisma/client";
import { invalidate } from "./cache";

export type StageSeed = { name: string; kind?: StageKind; slaHours?: number | null };

/**
 * Department templates from the PRD. These are starting points a group leader
 * edits — the engine has no opinion about stage names.
 */
export const PIPELINE_TEMPLATES: Record<Department, { name: string; stages: StageSeed[] }> = {
  sales: {
    name: "Sales",
    stages: [
      { name: "Enquiry received", slaHours: 4 },
      { name: "Talks initiated", slaHours: 24 },
      { name: "Problem statement gathered", slaHours: 48 },
      { name: "Proposal sent", slaHours: 72 },
      { name: "Negotiation", slaHours: 96 },
      { name: "Won", kind: "won" },
      { name: "Lost", kind: "lost" },
    ],
  },
  marketing: {
    name: "Marketing",
    stages: [
      { name: "Captured", slaHours: 2 },
      { name: "Qualifying", slaHours: 24 },
      { name: "MQL", slaHours: 48 },
      { name: "Handed to sales", kind: "won" },
      { name: "Disqualified", kind: "lost" },
    ],
  },
  support: {
    name: "Support",
    stages: [
      { name: "New", slaHours: 1 },
      { name: "Investigating", slaHours: 8 },
      { name: "Waiting on customer", slaHours: 72 },
      { name: "Resolved", kind: "won" },
      { name: "Closed without resolution", kind: "lost" },
    ],
  },
  collections: {
    name: "Collections",
    stages: [
      { name: "Due", slaHours: 24 },
      { name: "Contacted", slaHours: 48 },
      { name: "Promise to pay", slaHours: 168 },
      { name: "Escalated", slaHours: 72 },
      { name: "Recovered", kind: "won" },
      { name: "Written off", kind: "lost" },
    ],
  },
  recruitment: {
    name: "Recruitment",
    stages: [
      { name: "Applied", slaHours: 48 },
      { name: "Screened", slaHours: 72 },
      { name: "Interview", slaHours: 120 },
      { name: "Offer", slaHours: 72 },
      { name: "Hired", kind: "won" },
      { name: "Rejected", kind: "lost" },
    ],
  },
};

export async function createPipeline(
  organizationId: string,
  department: Department,
  opts: { name?: string; isDefault?: boolean; stages?: StageSeed[] } = {},
) {
  const tpl = PIPELINE_TEMPLATES[department];
  const stages = opts.stages ?? tpl.stages;
  return prisma.pipeline.create({
    data: {
      organizationId,
      department,
      name: opts.name ?? tpl.name,
      isDefault: opts.isDefault ?? false,
      stages: {
        create: stages.map((s, i) => ({
          name: s.name,
          position: i,
          kind: s.kind ?? "open",
          slaHours: s.slaHours ?? null,
        })),
      },
    },
    include: { stages: { orderBy: { position: "asc" } } },
  });
}

/** Every non-archived pipeline for an org, with its stages and item count. */
export async function listPipelines(organizationId: string) {
  await ensureDefaultPipeline(organizationId);
  return prisma.pipeline.findMany({
    where: { organizationId, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      stages: { orderBy: { position: "asc" } },
      _count: { select: { items: true } },
    },
  });
}

/** Idempotent: the org's default Sales pipeline, created on first use. */
export async function ensureDefaultPipeline(organizationId: string) {
  const existing = await prisma.pipeline.findFirst({
    where: { organizationId, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (existing) return existing;
  return createPipeline(organizationId, "sales", { isDefault: true });
}

export class StageHasItems extends Error {
  constructor() {
    super("This stage still has contacts in it — move them first.");
    this.name = "StageHasItems";
  }
}

/**
 * Reassign every stage in `orderedIds` to its index as the new position.
 *
 * Two passes because `@@unique([pipelineId, position])` is checked per
 * statement, not deferred: swapping two stages' positions directly would have
 * one UPDATE collide with the row that hasn't moved yet. Landing everyone on a
 * distinct negative position first guarantees no positive value is held by more
 * than one row at any point, so the second pass can never collide.
 */
async function reindexStages(pipelineId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.pipelineStage.update({ where: { id }, data: { position: -(i + 1) } })),
  );
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.pipelineStage.update({ where: { id }, data: { position: i } })),
  );
}

/** Add a stage to a pipeline, inserted at `atPosition` (default: append). */
export async function addStage(args: {
  organizationId: string;
  pipelineId: string;
  name: string;
  kind?: StageKind;
  slaHours?: number | null;
  atPosition?: number;
}) {
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: args.pipelineId, organizationId: args.organizationId },
  });
  if (!pipeline) throw new Error("Pipeline not found.");

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: args.pipelineId },
    orderBy: { position: "asc" },
  });

  const created = await prisma.pipelineStage.create({
    data: {
      pipelineId: args.pipelineId,
      name: args.name,
      kind: args.kind ?? "open",
      slaHours: args.slaHours ?? null,
      // Placeholder — reindexStages below assigns the real, final position.
      position: stages.length,
    },
  });

  const ids = stages.map((s) => s.id);
  ids.splice(Math.max(0, Math.min(args.atPosition ?? ids.length, ids.length)), 0, created.id);
  await reindexStages(args.pipelineId, ids);

  invalidate(`pipeline:${args.organizationId}`);
  return prisma.pipelineStage.findUniqueOrThrow({ where: { id: created.id } });
}

/** Rename, retime, retype, or reorder a stage. Any subset of fields may be passed. */
export async function updateStage(args: {
  organizationId: string;
  stageId: string;
  name?: string;
  kind?: StageKind;
  slaHours?: number | null;
  /** New 0-based position among the pipeline's stages. */
  position?: number;
}) {
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: args.stageId, pipeline: { organizationId: args.organizationId } },
  });
  if (!stage) throw new Error("Stage not found.");

  const { name, kind, slaHours } = args;
  if (name !== undefined || kind !== undefined || slaHours !== undefined) {
    await prisma.pipelineStage.update({
      where: { id: stage.id },
      data: {
        ...(name !== undefined && { name }),
        ...(kind !== undefined && { kind }),
        ...(slaHours !== undefined && { slaHours }),
      },
    });
  }

  if (args.position !== undefined) {
    const siblings = await prisma.pipelineStage.findMany({
      where: { pipelineId: stage.pipelineId },
      orderBy: { position: "asc" },
    });
    const ids = siblings.map((s) => s.id).filter((id) => id !== stage.id);
    ids.splice(Math.max(0, Math.min(args.position, ids.length)), 0, stage.id);
    await reindexStages(stage.pipelineId, ids);
  }

  invalidate(`pipeline:${args.organizationId}`);
  return prisma.pipelineStage.findUniqueOrThrow({ where: { id: stage.id } });
}

/** Remove a stage. Refuses if it still holds contacts, or if it's the pipeline's last stage. */
export async function deleteStage(args: { organizationId: string; stageId: string }) {
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: args.stageId, pipeline: { organizationId: args.organizationId } },
    include: { _count: { select: { items: true } } },
  });
  if (!stage) throw new Error("Stage not found.");
  if (stage._count.items > 0) throw new StageHasItems();

  const siblings = await prisma.pipelineStage.findMany({
    where: { pipelineId: stage.pipelineId },
    orderBy: { position: "asc" },
  });
  if (siblings.length <= 1) throw new Error("A pipeline needs at least one stage.");

  await prisma.pipelineStage.delete({ where: { id: stage.id } });
  await reindexStages(
    stage.pipelineId,
    siblings.filter((s) => s.id !== stage.id).map((s) => s.id),
  );

  invalidate(`pipeline:${args.organizationId}`);
}

function slaDue(from: Date, slaHours: number | null | undefined): Date | null {
  if (!slaHours || slaHours <= 0) return null;
  return new Date(from.getTime() + slaHours * 3600_000);
}

/** Put a contact into a pipeline at its first stage. Idempotent per pipeline. */
export async function addToPipeline(args: {
  organizationId: string;
  pipelineId: string;
  leadId: string;
  ownerId?: string | null;
  sourceId?: string | null;
  value?: number | null;
}) {
  const { organizationId, pipelineId, leadId } = args;

  const existing = await prisma.pipelineItem.findUnique({
    where: { pipelineId_leadId: { pipelineId, leadId } },
  });
  if (existing) return existing;

  const first = await prisma.pipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { position: "asc" },
  });
  if (!first) throw new Error("Pipeline has no stages.");

  const now = new Date();
  const item = await prisma.pipelineItem.create({
    data: {
      organizationId,
      pipelineId,
      stageId: first.id,
      leadId,
      ownerId: args.ownerId ?? null,
      sourceId: args.sourceId ?? null,
      value: args.value ?? null,
      enteredStageAt: now,
      slaDueAt: slaDue(now, first.slaHours),
    },
  });

  await prisma.stageTransition.create({
    data: { itemId: item.id, fromStageId: null, toStageId: first.id, direction: "forward", actorKind: "system" },
  });
  invalidate(`pipeline:${organizationId}`);
  return item;
}

export class BackwardMoveNeedsReason extends Error {
  constructor() {
    super("Moving a contact backwards requires a reason.");
    this.name = "BackwardMoveNeedsReason";
  }
}

/**
 * Move an item to a stage.
 *
 * Backward moves must carry a reason — that is the whole point of capturing
 * them, and it is enforced here rather than in the UI so the API, the agent and
 * a future bulk import all obey the same rule.
 */
export async function moveToStage(args: {
  organizationId: string;
  itemId: string;
  toStageId: string;
  actorId?: string | null;
  /** `ai` marks moves driven by extraction rather than a rep updating a dropdown. */
  actorKind?: "user" | "ai" | "system";
  reason?: string | null;
}) {
  const { organizationId, itemId, toStageId } = args;

  const item = await prisma.pipelineItem.findFirst({
    where: { id: itemId, organizationId },
    include: { stage: true },
  });
  if (!item) throw new Error("Pipeline item not found.");

  const to = await prisma.pipelineStage.findFirst({
    where: { id: toStageId, pipelineId: item.pipelineId },
  });
  if (!to) throw new Error("That stage belongs to a different pipeline.");
  if (to.id === item.stageId) return item;

  const direction = to.position > item.stage.position ? "forward" : "backward";
  const reason = args.reason?.trim() || null;
  if (direction === "backward" && !reason) throw new BackwardMoveNeedsReason();

  const now = new Date();
  const terminal = to.kind !== "open";

  const [updated] = await prisma.$transaction([
    prisma.pipelineItem.update({
      where: { id: item.id },
      data: {
        stageId: to.id,
        enteredStageAt: now,
        // A terminal stage stops the clock; re-opening restarts it.
        slaDueAt: terminal ? null : slaDue(now, to.slaHours),
        slaBreachedAt: null,
        closedAt: terminal ? now : null,
      },
    }),
    prisma.stageTransition.create({
      data: {
        itemId: item.id,
        fromStageId: item.stageId,
        toStageId: to.id,
        direction,
        reason,
        actorId: args.actorId ?? null,
        actorKind: args.actorKind ?? "user",
      },
    }),
  ]);

  invalidate(`pipeline:${organizationId}`);
  return updated;
}

/**
 * Everything past its SLA, most overdue first. Cross-pipeline and
 * cross-department by design — the PRD's ageing view is one list, not one per
 * team.
 */
export async function getAgeing(organizationId: string, limit = 100) {
  const now = new Date();
  const items = await prisma.pipelineItem.findMany({
    where: { organizationId, closedAt: null, slaDueAt: { not: null, lt: now } },
    orderBy: { slaDueAt: "asc" },
    take: limit,
    include: {
      stage: { select: { id: true, name: true, slaHours: true } },
      pipeline: { select: { id: true, name: true, department: true } },
      lead: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
      source: { select: { key: true, label: true } },
    },
  });
  return items.map((i) => ({
    ...i,
    value: i.value ? Number(i.value) : null,
    overdueHours: i.slaDueAt ? Math.floor((now.getTime() - i.slaDueAt.getTime()) / 3600_000) : 0,
  }));
}

/**
 * Mark newly-breached items and record an escalation against the owner's
 * manager. Idempotent: `slaBreachedAt` is the guard, so re-running never
 * double-escalates.
 */
export async function sweepSlaBreaches(organizationId: string) {
  const now = new Date();
  const due = await prisma.pipelineItem.findMany({
    where: { organizationId, closedAt: null, slaBreachedAt: null, slaDueAt: { not: null, lt: now } },
    select: { id: true, ownerId: true },
    take: 500,
  });
  if (due.length === 0) return { breached: 0, escalated: 0 };

  await prisma.pipelineItem.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { slaBreachedAt: now },
  });

  // Escalate one level up the hierarchy the org actually declared.
  let escalated = 0;
  for (const item of due) {
    const manager = item.ownerId
      ? await prisma.member.findFirst({
          where: { organizationId, userId: item.ownerId },
          select: { manager: { select: { userId: true } } },
        })
      : null;
    const toUserId = manager?.manager?.userId ?? null;
    await prisma.escalationEvent.create({
      data: { organizationId, itemId: item.id, level: toUserId ? 2 : 1, toUserId, channel: "in_app" },
    });
    escalated++;
  }

  invalidate(`pipeline:${organizationId}`);
  return { breached: due.length, escalated };
}

/** Board data: stages in order, each with its items. */
export async function getBoard(organizationId: string, pipelineId?: string) {
  const pipeline = pipelineId
    ? await prisma.pipeline.findFirst({ where: { id: pipelineId, organizationId } })
    : await ensureDefaultPipeline(organizationId);
  if (!pipeline) return null;

  const [stages, items] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { pipelineId: pipeline.id }, orderBy: { position: "asc" } }),
    prisma.pipelineItem.findMany({
      where: { pipelineId: pipeline.id, organizationId },
      orderBy: { enteredStageAt: "asc" },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
        source: { select: { key: true, label: true } },
      },
    }),
  ]);

  const now = Date.now();
  return {
    pipeline: { id: pipeline.id, name: pipeline.name, department: pipeline.department },
    stages: stages.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      slaHours: s.slaHours,
      items: items
        .filter((i) => i.stageId === s.id)
        .map((i) => ({
          id: i.id,
          leadId: i.leadId,
          name: [i.lead.firstName, i.lead.lastName].filter(Boolean).join(" ") || i.lead.email || "Unnamed contact",
          company: i.lead.company,
          email: i.lead.email,
          source: i.source?.label ?? null,
          value: i.value ? Number(i.value) : null,
          ownerId: i.ownerId,
          enteredStageAt: i.enteredStageAt.toISOString(),
          slaDueAt: i.slaDueAt?.toISOString() ?? null,
          overdue: !!(i.slaDueAt && i.slaDueAt.getTime() < now),
        })),
    })),
  };
}

/** Share of stage moves the AI drove — the PRD's headline success metric. */
export async function getAiMoveShare(organizationId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.stageTransition.groupBy({
    by: ["actorKind"],
    where: { at: { gte: since }, item: { organizationId } },
    _count: { _all: true },
  });
  const total = rows.reduce((n, r) => n + r._count._all, 0);
  const ai = rows.find((r) => r.actorKind === "ai")?._count._all ?? 0;
  return { total, ai, share: total === 0 ? 0 : ai / total };
}
