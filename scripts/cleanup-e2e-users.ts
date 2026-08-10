/**
 * Removes users created by the e2e suite, plus the workspaces auto-created for
 * them. These land in whatever database .env.local points at — which is the
 * same Supabase project production uses — so this is worth running after a
 * test session.
 *
 *   npx tsx scripts/cleanup-e2e-users.ts          # dry run, lists what it would delete
 *   npx tsx scripts/cleanup-e2e-users.ts --apply  # actually delete
 */
import { prisma } from "../lib/db";

const PREFIXES = ["e2e-tour-", "e2e-del-", "e2e-act-", "tour-check-"];
const apply = process.argv.includes("--apply");

async function main() {
  const users = await prisma.user.findMany({
    where: { OR: PREFIXES.map((p) => ({ email: { startsWith: p } })) },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (users.length === 0) {
    console.log("No e2e users found.");
    return;
  }

  console.log(`Found ${users.length} e2e user(s):`);
  for (const u of users) console.log(`  ${u.email}  (${u.createdAt.toISOString()})`);

  const userIds = users.map((u) => u.id);
  const memberships = await prisma.member.findMany({
    where: { userId: { in: userIds } },
    select: { organizationId: true },
  });
  const orgIds = [...new Set(memberships.map((m) => m.organizationId))];

  // Only drop organisations whose entire membership is e2e users, so a shared
  // workspace can never be collateral damage.
  const orphanOrgIds: string[] = [];
  for (const orgId of orgIds) {
    const others = await prisma.member.count({
      where: { organizationId: orgId, userId: { notIn: userIds } },
    });
    if (others === 0) orphanOrgIds.push(orgId);
  }
  console.log(`\n${orphanOrgIds.length} workspace(s) would be removed with them.`);

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to delete.");
    return;
  }

  // Tenant rows first, then memberships, then users.
  for (const orgId of orphanOrgIds) {
    await prisma.$transaction([
      prisma.activityLog.deleteMany({ where: { organizationId: orgId } }),
      prisma.message.deleteMany({ where: { organizationId: orgId } }),
      prisma.enrollment.deleteMany({ where: { organizationId: orgId } }),
      prisma.inboxMessage.deleteMany({ where: { thread: { organizationId: orgId } } }),
      prisma.inboxThread.deleteMany({ where: { organizationId: orgId } }),
      prisma.lead.deleteMany({ where: { organizationId: orgId } }),
      prisma.campaign.deleteMany({ where: { organizationId: orgId } }),
      prisma.template.deleteMany({ where: { organizationId: orgId } }),
      prisma.segment.deleteMany({ where: { organizationId: orgId } }),
      prisma.suppression.deleteMany({ where: { organizationId: orgId } }),
      prisma.sendingAccount.deleteMany({ where: { organizationId: orgId } }),
      prisma.invitation.deleteMany({ where: { organizationId: orgId } }),
      prisma.member.deleteMany({ where: { organizationId: orgId } }),
      prisma.organization.delete({ where: { id: orgId } }),
    ]);
  }

  await prisma.member.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log(`\nDeleted ${users.length} user(s) and ${orphanOrgIds.length} workspace(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
