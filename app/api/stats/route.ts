import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";

// GET /api/stats — dashboard overview counts (cached 30s per org; COUNTs get costly at scale).
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { orgId } = ctx;

  const stats = await cached(`stats:${orgId}`, 30_000, async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [leads, sentToday, replies, activeCampaigns, suppressed] = await Promise.all([
      prisma.lead.count({ where: { organizationId: orgId } }),
      prisma.message.count({ where: { organizationId: orgId, status: "sent", sentAt: { gte: startOfDay } } }),
      prisma.activityLog.count({ where: { organizationId: orgId, type: "replied" } }),
      prisma.campaign.count({ where: { organizationId: orgId, status: "active" } }),
      prisma.suppression.count({ where: { organizationId: orgId } }),
    ]);
    return { leads, sentToday, replies, activeCampaigns, suppressed };
  });

  return ok(stats);
}
