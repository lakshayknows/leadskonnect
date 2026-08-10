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

export async function getStats(orgId: string) {
  return cached(`stats:${orgId}`, 30_000, async () => {
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
}

export function getSendingAccounts(orgId: string) {
  return prisma.sendingAccount.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    select: SEND_ACCOUNT_SELECT,
  });
}

export async function getTemplates(orgId: string) {
  let templates = await prisma.template.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
  if (templates.length === 0) {
    await prisma.template.createMany({ data: SEED_TEMPLATES.map((t) => ({ ...t, organizationId: orgId })) });
    templates = await prisma.template.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
  }
  return templates;
}

export function getCampaigns(orgId: string) {
  return prisma.campaign.findMany({
    where: { organizationId: orgId },
    include: { sendingAccount: true, _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function getSegments(orgId: string) {
  return prisma.segment.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
}

/** Companies derived from contacts (grouped by the `company` field). */
export async function getCompanies(orgId: string) {
  const rows = await prisma.lead.groupBy({
    by: ["company"],
    where: { organizationId: orgId, company: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { company: "desc" } },
    take: 200,
  });
  return rows
    .filter((r) => (r.company ?? "").trim() !== "")
    .map((r) => ({ company: r.company as string, count: r._count._all }));
}

export async function getInboxThreads(orgId: string, status?: string) {
  const threads = await prisma.inboxThread.findMany({
    where: { organizationId: orgId, ...(status ? { status: status as never } : {}) },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });
  return threads.map((t) => ({
    id: t.id,
    status: t.status,
    subject: t.subject,
    channel: t.channel,
    lastMessageAt: t.lastMessageAt,
    lead: t.lead,
    preview: t.messages[0]?.body?.slice(0, 140) ?? "",
    direction: t.messages[0]?.direction ?? null,
  }));
}

export async function getLeadsPage(orgId: string, page = 1, pageSize = 50, q?: string, book?: "email" | "linkedin") {
  const where: Prisma.LeadWhereInput = {
    organizationId: orgId,
    ...(book === "email" ? { email: { not: null } } : book === "linkedin" ? { linkedinUrl: { not: null } } : {}),
    ...(q?.trim()
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: pageSize, skip: (page - 1) * pageSize }),
    cached(`leads:count:${orgId}:${book ?? ""}:${q ?? ""}`, 15_000, () => prisma.lead.count({ where })),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}

/* ------------------------------------------------------------------ */
/* Onboarding + activation                                             */
/* ------------------------------------------------------------------ */

/** Bump to re-offer the tour to everyone after materially changing its steps. */
export const TOUR_VERSION = 1;

export type OnboardingState = {
  completedAt: string | null;
  skippedAt: string | null;
  step: number;
  tourVersion: number;
  theme: string | null;
  checklistDismissedAt: string | null;
};

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    // Select only the app-owned columns — never widen this to the whole user row.
    select: {
      onboardingCompletedAt: true,
      onboardingSkippedAt: true,
      onboardingStep: true,
      tourVersion: true,
      themePreference: true,
      checklistState: true,
    },
  });
  const checklist = (u?.checklistState ?? null) as { dismissedAt?: string | null } | null;
  return {
    completedAt: u?.onboardingCompletedAt?.toISOString() ?? null,
    skippedAt: u?.onboardingSkippedAt?.toISOString() ?? null,
    step: u?.onboardingStep ?? 0,
    tourVersion: u?.tourVersion ?? 0,
    theme: u?.themePreference ?? null,
    checklistDismissedAt: checklist?.dismissedAt ?? null,
  };
}

export type Activation = {
  sendingAccount: boolean;
  leads: boolean;
  template: boolean;
  campaign: boolean;
  sent: boolean;
};

/**
 * Activation is DERIVED from real data on every read, never stored. A stored
 * "done" flag drifts the moment a user deletes the thing it was counting, and
 * then the checklist quietly lies about the state of the workspace.
 */
export async function getActivation(orgId: string): Promise<Activation> {
  return cached(`activation:${orgId}`, 30_000, async () => {
    const [sendingAccount, leads, template, campaign, sent] = await Promise.all([
      prisma.sendingAccount.count({ where: { organizationId: orgId }, take: 1 }),
      prisma.lead.count({ where: { organizationId: orgId }, take: 1 }),
      prisma.template.count({ where: { organizationId: orgId }, take: 1 }),
      prisma.campaign.count({ where: { organizationId: orgId }, take: 1 }),
      prisma.message.count({ where: { organizationId: orgId, status: "sent" }, take: 1 }),
    ]);
    return {
      sendingAccount: sendingAccount > 0,
      leads: leads > 0,
      template: template > 0,
      campaign: campaign > 0,
      sent: sent > 0,
    };
  });
}
