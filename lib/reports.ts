/**
 * Reports aggregations — funnel, engagement rates, time series, and per-campaign
 * breakdown, all from Message + ActivityLog (the event store). Fed to /dashboard/reports.
 *
 * getPipelineFunnels/getSourceRoi/getResponseLeaderboard are additive: the funnel above
 * (`getReport`) still groups by the legacy Lead.stage enum, which older campaign-only
 * flows still write. These three read the newer Pipeline/PipelineItem/StageTransition
 * model instead, since that's what the product PRD's §8 reporting actually calls for.
 */
import { prisma } from "./db";
import type { Department } from "@prisma/client";

export interface ReportData {
  days: number;
  totals: { leads: number; sent: number; opened: number; clicked: number; replied: number; suppressed: number };
  rates: { open: number; click: number; reply: number }; // percentages 0–100
  funnel: { stage: string; count: number }[];
  series: { date: string; sent: number; opened: number; clicked: number; replied: number }[];
  byCampaign: { id: string; name: string; enrolled: number; sent: number; opened: number; replied: number }[];
}

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

export async function getReport(orgId: string, days = 30): Promise<ReportData> {
  const since = new Date(Date.now() - days * DAY);

  const [leads, messages, activities, stageGroups, campaigns, suppressed] = await Promise.all([
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.message.findMany({
      where: { organizationId: orgId, sentAt: { gte: since } },
      select: { sentAt: true, campaignId: true },
    }),
    prisma.activityLog.findMany({
      where: { organizationId: orgId, at: { gte: since }, type: { in: ["opened", "clicked", "replied"] } },
      select: { at: true, type: true, messageId: true, campaignId: true },
    }),
    prisma.lead.groupBy({ by: ["stage"], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.campaign.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, _count: { select: { enrollments: true } } },
    }),
    prisma.suppression.count({ where: { organizationId: orgId } }),
  ]);

  const openedMsgs = new Set(activities.filter((a) => a.type === "opened" && a.messageId).map((a) => a.messageId));
  const clickedMsgs = new Set(activities.filter((a) => a.type === "clicked" && a.messageId).map((a) => a.messageId));
  const repliedCount = activities.filter((a) => a.type === "replied").length;
  const sent = messages.length;

  // Time series (fill every day in the window).
  const buckets = new Map<string, { sent: number; opened: number; clicked: number; replied: number }>();
  for (let i = 0; i <= days; i++) buckets.set(dayKey(new Date(since.getTime() + i * DAY)), { sent: 0, opened: 0, clicked: 0, replied: 0 });
  for (const m of messages) if (m.sentAt) { const b = buckets.get(dayKey(m.sentAt)); if (b) b.sent++; }
  for (const a of activities) {
    const b = buckets.get(dayKey(a.at));
    if (!b) continue;
    if (a.type === "opened") b.opened++;
    else if (a.type === "clicked") b.clicked++;
    else if (a.type === "replied") b.replied++;
  }
  const series = Array.from(buckets.entries()).map(([date, v]) => ({ date, ...v }));

  // Per-campaign breakdown.
  const byCampaign = campaigns.map((c) => {
    const cSent = messages.filter((m) => m.campaignId === c.id).length;
    const cOpened = new Set(activities.filter((a) => a.type === "opened" && a.campaignId === c.id && a.messageId).map((a) => a.messageId)).size;
    const cReplied = activities.filter((a) => a.type === "replied" && a.campaignId === c.id).length;
    return { id: c.id, name: c.name, enrolled: c._count.enrollments, sent: cSent, opened: cOpened, replied: cReplied };
  }).sort((a, b) => b.sent - a.sent);

  return {
    days,
    totals: { leads, sent, opened: openedMsgs.size, clicked: clickedMsgs.size, replied: repliedCount, suppressed },
    rates: { open: pct(openedMsgs.size, sent), click: pct(clickedMsgs.size, sent), reply: pct(repliedCount, sent) },
    funnel: stageGroups.map((g) => ({ stage: g.stage, count: g._count._all })),
    series,
    byCampaign,
  };
}

export interface PipelineFunnel {
  pipelineId: string;
  pipelineName: string;
  department: Department;
  stages: { name: string; position: number; kind: string; count: number }[];
}

/** Per-department pipeline funnel — where contacts actually sit, stage by stage. */
export async function getPipelineFunnels(orgId: string, department?: Department): Promise<PipelineFunnel[]> {
  const pipelines = await prisma.pipeline.findMany({
    where: { organizationId: orgId, archivedAt: null, ...(department && { department }) },
    orderBy: { createdAt: "asc" },
    include: {
      stages: {
        orderBy: { position: "asc" },
        select: { name: true, position: true, kind: true, _count: { select: { items: true } } },
      },
    },
  });
  return pipelines.map((p) => ({
    pipelineId: p.id,
    pipelineName: p.name,
    department: p.department,
    stages: p.stages.map((s) => ({ name: s.name, position: s.position, kind: s.kind, count: s._count.items })),
  }));
}

export interface SourceRoi {
  sourceId: string;
  key: string;
  label: string;
  monthlyCost: number | null;
  totalItems: number;
  wonItems: number;
  wonValue: number;
  /** Monthly cost divided by wins — null when cost or wins aren't both known. */
  costPerWon: number | null;
}

/** Cost-per-source vs. conversion (product PRD §8) — is a source actually paying for itself. */
export async function getSourceRoi(orgId: string): Promise<SourceRoi[]> {
  const [sources, items] = await Promise.all([
    prisma.leadSource.findMany({ where: { organizationId: orgId }, select: { id: true, key: true, label: true, monthlyCost: true } }),
    prisma.pipelineItem.findMany({
      where: { organizationId: orgId, sourceId: { not: null } },
      select: { sourceId: true, value: true, stage: { select: { kind: true } } },
    }),
  ]);

  return sources
    .map((s) => {
      const rows = items.filter((i) => i.sourceId === s.id);
      const won = rows.filter((i) => i.stage.kind === "won");
      const wonValue = won.reduce((n, i) => n + (i.value ? Number(i.value) : 0), 0);
      const monthlyCost = s.monthlyCost ? Number(s.monthlyCost) : null;
      return {
        sourceId: s.id,
        key: s.key,
        label: s.label,
        monthlyCost,
        totalItems: rows.length,
        wonItems: won.length,
        wonValue,
        costPerWon: monthlyCost && won.length > 0 ? Math.round((monthlyCost / won.length) * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.totalItems - a.totalItems);
}

export interface ResponseLeaderboardRow {
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  itemsRespondedTo: number;
  avgResponseHours: number;
}

/**
 * Per-rep response-time leaderboard: hours from a contact entering a pipeline to the
 * first human-driven (`actorKind: "user"`) stage move on it. Fastest first.
 */
export async function getResponseLeaderboard(orgId: string, days = 30): Promise<ResponseLeaderboardRow[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const items = await prisma.pipelineItem.findMany({
    where: { organizationId: orgId, createdAt: { gte: since }, ownerId: { not: null } },
    select: {
      ownerId: true,
      createdAt: true,
      transitions: { where: { actorKind: "user" }, orderBy: { at: "asc" }, take: 1, select: { at: true } },
    },
  });

  const byOwner = new Map<string, { totalHours: number; count: number }>();
  for (const item of items) {
    const first = item.transitions[0];
    if (!first || !item.ownerId) continue;
    const hours = (first.at.getTime() - item.createdAt.getTime()) / 3_600_000;
    if (hours < 0) continue;
    const cur = byOwner.get(item.ownerId) ?? { totalHours: 0, count: 0 };
    cur.totalHours += hours;
    cur.count += 1;
    byOwner.set(item.ownerId, cur);
  }

  const ownerIds = [...byOwner.keys()];
  const users = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return ownerIds
    .map((id) => {
      const { totalHours, count } = byOwner.get(id)!;
      const u = userById.get(id);
      return {
        ownerId: id,
        ownerName: u?.name ?? null,
        ownerEmail: u?.email ?? "",
        itemsRespondedTo: count,
        avgResponseHours: Math.round((totalHours / count) * 10) / 10,
      };
    })
    .sort((a, b) => a.avgResponseHours - b.avgResponseHours);
}
