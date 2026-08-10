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
import type { Channel } from "@prisma/client";

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
