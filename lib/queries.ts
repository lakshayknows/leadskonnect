/**
 * Server-side data functions for the dashboard's Server Components. These run on the
 * server (co-located with the DB), so pages render with data already in the HTML —
 * fast first paint, no client waterfall, nothing cached on disk. The results are
 * handed to the client as SWR fallback (keyed by the same URL the client fetches).
 *
 * Query shapes here MUST match the matching /api routes so the client's background
 * revalidation returns the identical shape.
 */
import { prisma } from "./db";
import { cached } from "./cache";
import { SEED_TEMPLATES } from "./templates-seed";
import type { Prisma } from "@prisma/client";

const SEND_ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  provider: true,
  host: true,
  port: true,
  secure: true,
  user: true,
  from: true,
  active: true,
  createdAt: true,
} satisfies Prisma.SendingAccountSelect;

export async function getStats() {
  return cached("stats", 30_000, async () => {
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
}

export function getSendingAccounts() {
  return prisma.sendingAccount.findMany({ orderBy: { createdAt: "desc" }, select: SEND_ACCOUNT_SELECT });
}

export async function getTemplates() {
  let templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  if (templates.length === 0) {
    await prisma.template.createMany({ data: SEED_TEMPLATES });
    templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  }
  return templates;
}

export function getCampaigns() {
  return prisma.campaign.findMany({ include: { sendingAccount: true }, orderBy: { createdAt: "desc" } });
}

export async function getLeadsPage(page = 1, pageSize = 50, q?: string) {
  const where: Prisma.LeadWhereInput = q?.trim()
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: pageSize, skip: (page - 1) * pageSize }),
    cached(`leads:count::${q ?? ""}`, 15_000, () => prisma.lead.count({ where })),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}
