/**
 * One-off backfill: give existing (pre-multi-tenancy) data a home.
 *
 * Safe to run repeatedly (idempotent). It:
 *  1. Ensures a "Default Workspace" organization exists.
 *  2. Makes every existing user a member (the first becomes owner).
 *  3. Assigns every null-org row across all tenant tables to that org.
 *
 * Run once after `prisma db push`:  npx tsx scripts/backfill-org.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Default org
  let org = await prisma.organization.findFirst({ where: { slug: "default-workspace" } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Default Workspace", slug: "default-workspace" },
    });
    console.log(`Created default org ${org.id}`);
  } else {
    console.log(`Using existing default org ${org.id}`);
  }

  // 2. Memberships for existing users
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  for (const [i, user] of users.entries()) {
    const existing = await prisma.member.findFirst({ where: { userId: user.id } });
    if (existing) continue;
    await prisma.member.create({
      data: { organizationId: org.id, userId: user.id, role: i === 0 ? "owner" : "member" },
    });
    console.log(`Added ${user.email} as ${i === 0 ? "owner" : "member"}`);
  }

  // 3. Backfill null-org rows across every tenant table.
  const orgId = org.id;
  const results: Record<string, number> = {};
  results.lead = (await prisma.lead.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;
  results.campaign = (await prisma.campaign.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;
  results.template = (await prisma.template.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;
  results.message = (await prisma.message.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;
  results.activityLog = (await prisma.activityLog.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;
  results.suppression = (await prisma.suppression.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;
  results.sendingAccount = (await prisma.sendingAccount.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;
  results.segment = (await prisma.segment.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;
  results.enrollment = (await prisma.enrollment.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } })).count;

  console.log("Backfilled rows:", results);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
