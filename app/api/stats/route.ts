import { prisma } from "@/lib/db";
import { ok, requireDb } from "@/lib/http";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";

// GET /api/stats — dashboard overview counts (cached 30s; five COUNTs get costly at scale).
export async function GET() {
  const guard = requireDb();
  if (guard) return guard;

  const stats = await cached("stats", 30_000, async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [leads, sentToday, replies, activeCampaigns, suppressed] = await Promise.all([
      prisma.lead.count(),
      prisma.message.count({ where: { status: "sent", sentAt: { gte: startOfDay } } }),
      prisma.activityLog.count({ where: { type: "replied" } }),
      prisma.campaign.count({ where: { status: "active" } }),
      prisma.suppression.count(),
    ]);
    return { leads, sentToday, replies, activeCampaigns, suppressed };
  });

  return ok(stats);
}
