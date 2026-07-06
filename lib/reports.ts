/**
 * Reports aggregations — funnel, engagement rates, time series, and per-campaign
 * breakdown, all from Message + ActivityLog (the event store). Fed to /dashboard/reports.
 */
import { prisma } from "./db";

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
