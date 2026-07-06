/**
 * Campaign conditional-node engine.
 *
 * A campaign's `sequence` is a node graph (send / condition / wait / exit). Each lead is
 * an Enrollment that walks the graph one node at a time. Instead of enqueuing every step
 * up-front, we enqueue a single "advance" job per hop — so branches, waits, and
 * reply-driven stops all happen reactively at run time.
 *
 * Default behavior: a reply anywhere halts the enrollment (stop-on-reply). A `condition`
 * node lets a campaign branch explicitly on replied/opened/clicked.
 */
import { z } from "zod";
import { prisma } from "./db";
import { logActivity } from "./crm";
import { jitterMs } from "./ratelimit";
import { enqueueJob } from "./queue";
import { processSendJob } from "./job-processor";
import type { Enrollment } from "@prisma/client";

const CHANNELS = ["email", "linkedin", "whatsapp", "social"] as const;

export const SendNode = z.object({
  id: z.string(),
  type: z.literal("send"),
  channel: z.enum(CHANNELS),
  templateId: z.string().nullable().optional(),
  waitDays: z.number().min(0).default(0),
  next: z.string().nullable().optional(),
});

export const ConditionNode = z.object({
  id: z.string(),
  type: z.literal("condition"),
  on: z.enum(["replied", "not_replied", "opened", "not_opened", "clicked"]),
  withinDays: z.number().min(0).optional(),
  onYes: z.string().nullable().optional(),
  onNo: z.string().nullable().optional(),
});

export const WaitNode = z.object({
  id: z.string(),
  type: z.literal("wait"),
  waitDays: z.number().min(0).default(1),
  next: z.string().nullable().optional(),
});

export const ExitNode = z.object({ id: z.string(), type: z.literal("exit") });

export const CampaignNode = z.discriminatedUnion("type", [SendNode, ConditionNode, WaitNode, ExitNode]);
export type CampaignNode = z.infer<typeof CampaignNode>;

export const GraphSequence = z.object({
  nodes: z.array(CampaignNode),
  startNodeId: z.string().nullable().optional(),
});

// Legacy flat step array (older campaigns / the simple builder).
const LegacyStep = z.object({
  channel: z.enum(CHANNELS),
  templateId: z.string().nullable().optional(),
  waitDays: z.number().min(0).default(0),
  unless: z.string().optional(),
  onlyIf: z.string().optional(),
});

export const CampaignSequence = z.union([GraphSequence, z.array(LegacyStep)]);
export type CampaignSequence = z.infer<typeof CampaignSequence>;

export interface NormalizedGraph {
  nodes: Record<string, CampaignNode>;
  startNodeId: string | null;
}

/** Convert a stored sequence (graph OR legacy flat array) into a node map. */
export function normalizeSequence(raw: unknown): NormalizedGraph {
  const parsed = CampaignSequence.safeParse(raw);
  if (!parsed.success) return { nodes: {}, startNodeId: null };
  const seq = parsed.data;

  if (Array.isArray(seq)) {
    const nodes: Record<string, CampaignNode> = {};
    seq.forEach((s, i) => {
      const id = `n${i}`;
      nodes[id] = {
        id,
        type: "send",
        channel: s.channel,
        templateId: s.templateId ?? null,
        waitDays: s.waitDays,
        next: i < seq.length - 1 ? `n${i + 1}` : null,
      };
    });
    return { nodes, startNodeId: seq.length ? "n0" : null };
  }

  const nodes: Record<string, CampaignNode> = {};
  for (const n of seq.nodes) nodes[n.id] = n;
  return { nodes, startNodeId: seq.startNodeId ?? seq.nodes[0]?.id ?? null };
}

function delayForNodeMs(node: CampaignNode): number {
  if (node.type === "send") return node.waitDays * 86_400_000 + jitterMs();
  if (node.type === "wait") return node.waitDays * 86_400_000;
  return 0;
}

/** Set the enrollment's current node + nextRunAt and enqueue the advance that runs it. */
export async function scheduleAdvance(enrollmentId: string, node: CampaignNode): Promise<boolean> {
  const delay = delayForNodeMs(node);
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { currentNodeId: node.id, nextRunAt: new Date(Date.now() + delay) },
  });
  return enqueueJob({ kind: "advance", enrollmentId }, delay);
}

async function finish(id: string, status: "completed" | "stopped" | "replied") {
  await prisma.enrollment.update({ where: { id }, data: { status, nextRunAt: null } });
}

/** Has the lead replied since this enrollment began (optionally within N days)? */
async function hasReplied(enr: Enrollment): Promise<boolean> {
  const since = enr.createdAt;
  const a = await prisma.activityLog.findFirst({
    where: {
      leadId: enr.leadId,
      ...(enr.organizationId ? { organizationId: enr.organizationId } : {}),
      type: "replied",
      at: { gte: since },
    },
  });
  return !!a;
}

async function hasActivity(enr: Enrollment, type: "opened" | "clicked"): Promise<boolean> {
  const a = await prisma.activityLog.findFirst({
    where: {
      leadId: enr.leadId,
      ...(enr.organizationId ? { organizationId: enr.organizationId } : {}),
      type,
      at: { gte: enr.createdAt },
    },
  });
  return !!a;
}

async function evaluateCondition(enr: Enrollment, node: z.infer<typeof ConditionNode>): Promise<boolean> {
  switch (node.on) {
    case "replied": return hasReplied(enr);
    case "not_replied": return !(await hasReplied(enr));
    case "opened": return hasActivity(enr, "opened");
    case "not_opened": return !(await hasActivity(enr, "opened"));
    case "clicked": return hasActivity(enr, "clicked");
    default: return false;
  }
}

/**
 * Advance one enrollment by executing its current node and scheduling the next hop.
 * Idempotent-ish: a rate-limit inside a send re-throws so the queue retries this advance
 * (the enrollment's currentNodeId hasn't moved, so the send re-runs).
 */
export async function advanceEnrollment(enrollmentId: string): Promise<void> {
  const enr = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { campaign: true },
  });
  if (!enr) return;
  if (enr.status !== "active") return; // paused / replied / stopped / completed
  if (!enr.currentNodeId) return finish(enr.id, "completed");

  const orgId = enr.organizationId ?? enr.campaign.organizationId;
  if (!orgId) return finish(enr.id, "stopped");

  const graph = normalizeSequence(enr.campaign.sequence);
  const node = graph.nodes[enr.currentNodeId];
  if (!node) return finish(enr.id, "completed");

  let nextId: string | null = null;

  if (node.type === "exit") {
    return finish(enr.id, "completed");
  }

  if (node.type === "send") {
    // Default stop-on-reply: never send another message after the lead has replied.
    if (await hasReplied(enr)) return finish(enr.id, "replied");
    await processSendJob({
      kind: "send",
      organizationId: orgId,
      channel: node.channel,
      leadId: enr.leadId,
      campaignId: enr.campaignId,
      templateId: node.templateId ?? undefined,
      account: enr.campaign.sendingAccountId || "default",
    });
    nextId = node.next ?? null;
  } else if (node.type === "wait") {
    nextId = node.next ?? null;
  } else if (node.type === "condition") {
    const yes = await evaluateCondition(enr, node);
    await prisma.enrollment.update({
      where: { id: enr.id },
      data: { branch: `${node.on}:${yes ? "yes" : "no"}` },
    });
    nextId = (yes ? node.onYes : node.onNo) ?? null;
  }

  if (!nextId) return finish(enr.id, "completed");
  const nextNode = graph.nodes[nextId];
  if (!nextNode) return finish(enr.id, "completed");

  await scheduleAdvance(enr.id, nextNode);
  await logActivity({
    organizationId: orgId,
    leadId: enr.leadId,
    campaignId: enr.campaignId,
    type: "enrollment_advanced",
    meta: { from: node.id, to: nextNode.id },
  }).catch(() => {});
}
