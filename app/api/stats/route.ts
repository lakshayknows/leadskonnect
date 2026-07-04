import { prisma } from "@/lib/db";
import { ok, requireDb } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/stats — dashboard overview counts.
export async function GET() {
  const guard = requireDb();
  if (guard) return guard;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [leads, sentToday, replies, activeCampaigns, suppressed] = await Promise.all([
    prisma.lead.count(),
    prisma.message.count({ where: { status: "sent", sentAt: { gte: startOfDay } } }),
    prisma.activityLog.count({ where: { type: "replied" } }),
    prisma.campaign.count({ where: { status: "active" } }),
    prisma.suppression.count(),
  ]);

  return ok({ leads, sentToday, replies, activeCampaigns, suppressed });
}
