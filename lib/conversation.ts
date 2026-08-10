/**
 * The one place that writes ConversationEvent — the "one timeline per identity" the
 * product PRD calls for. Previously only the inbound-webhook ingest path (lib/ingest.ts)
 * ever wrote one; outbound sends and inbound email replies wrote exclusively to the older
 * InboxThread/InboxMessage tables, so the two never met. This is additive: InboxThread/
 * InboxMessage keep being written too (retiring them is a separate, riskier follow-up
 * once every reader has moved off them) — this just makes ConversationEvent genuinely
 * complete instead of partially populated.
 */
import { prisma } from "./db";
import type { Channel, Department } from "@prisma/client";

export async function recordConversationEvent(args: {
  organizationId: string;
  leadId: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  subject?: string | null;
  body?: string | null;
  status?: string | null;
  externalId?: string | null;
  occurredAt?: Date;
  meta?: Record<string, unknown>;
}) {
  // "global" is safeSend()'s defensive default when a caller omits orgId — every real
  // call site passes a real one, so this only guards against writing a nonsensical row.
  if (!args.organizationId || args.organizationId === "global" || !args.leadId) return;

  try {
    await prisma.conversationEvent.create({
      data: {
        organizationId: args.organizationId,
        leadId: args.leadId,
        channel: args.channel,
        direction: args.direction,
        subject: args.subject ?? null,
        body: args.body ?? null,
        status: args.status ?? null,
        // Null externalIds never collide under the unique constraint (standard SQL:
        // NULL <> NULL), so it's safe to omit this for sends with no stable provider id.
        externalId: args.externalId ?? null,
        occurredAt: args.occurredAt ?? new Date(),
        meta: (args.meta ?? {}) as object,
      },
    });
  } catch (e) {
    // Best-effort — recording the timeline should never fail the send/receive it's
    // describing. A duplicate externalId (webhook replay racing a manual write, etc.)
    // lands here too.
    console.error("[conversation] failed to record event:", e);
  }
}

/**
 * Control tower (product PRD §12 differentiator): a monitoring/jump-in list of currently
 * open conversations across every channel, for a group leader/admin — not a live-chat
 * console, just "what's active and does it need a human right now." Built on the same
 * unified ConversationEvent timeline Phase 1b made complete.
 *
 * "Open" = an active (non-closed) pipeline item. "Needs attention" = the contact's last
 * message hasn't been answered yet (their inbound event is the most recent one).
 */
export async function getControlTower(organizationId: string, limit = 100, department?: Department) {
  const items = await prisma.pipelineItem.findMany({
    where: { organizationId, closedAt: null, ...(department && { pipeline: { department } }) },
    orderBy: { updatedAt: "desc" },
    take: Math.max(limit, 200), // pull a wider candidate set than `limit` so re-sorting below (attention-first) doesn't starve the final page
    select: {
      id: true,
      ownerId: true,
      lead: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
      stage: { select: { name: true } },
      pipeline: { select: { department: true } },
    },
  });
  if (items.length === 0) return [];

  const leadIds = items.map((i) => i.lead.id);
  // No native "distinct on" in the Prisma client — pull recent events for these leads and
  // reduce to one-per-lead in JS. Capped: this is a snapshot list, not full history.
  const events = await prisma.conversationEvent.findMany({
    where: { organizationId, leadId: { in: leadIds } },
    orderBy: { occurredAt: "desc" },
    take: Math.min(leadIds.length * 3, 1500),
    select: { leadId: true, channel: true, direction: true, subject: true, body: true, occurredAt: true },
  });
  const latestByLead = new Map<string, (typeof events)[number]>();
  for (const e of events) {
    if (!latestByLead.has(e.leadId)) latestByLead.set(e.leadId, e);
  }

  const ownerIds = [...new Set(items.map((i) => i.ownerId).filter((id): id is string => !!id))];
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return items
    .map((item) => {
      const latest = latestByLead.get(item.lead.id) ?? null;
      return {
        pipelineItemId: item.id,
        lead: item.lead,
        stage: item.stage.name,
        department: item.pipeline.department,
        owner: item.ownerId ? (ownerById.get(item.ownerId) ?? null) : null,
        lastEvent: latest
          ? {
              channel: latest.channel,
              direction: latest.direction,
              preview: (latest.subject || latest.body || "").slice(0, 140),
              occurredAt: latest.occurredAt,
            }
          : null,
        awaitingReply: latest?.direction === "inbound",
      };
    })
    .sort((a, b) => {
      if (a.awaitingReply !== b.awaitingReply) return a.awaitingReply ? -1 : 1;
      const at = a.lastEvent?.occurredAt.getTime() ?? 0;
      const bt = b.lastEvent?.occurredAt.getTime() ?? 0;
      return bt - at;
    })
    .slice(0, limit);
}
