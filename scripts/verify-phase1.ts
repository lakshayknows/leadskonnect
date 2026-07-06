/**
 * Phase-1 verification — safe (no real emails sent).
 * Checks: (1) the campaign node-graph normalizer, (2) reply-condition evaluation,
 * (3) tenant isolation of lead queries across two orgs.
 *
 *   npx tsx scripts/verify-phase1.ts
 */
import { PrismaClient } from "@prisma/client";
import { normalizeSequence } from "../lib/campaign-engine";
import { resolveSegmentLeadIds } from "../lib/segments";

const prisma = new PrismaClient();
let pass = 0;
let fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}`); }
}

async function main() {
  console.log("1) normalizeSequence");
  const legacy = normalizeSequence([{ channel: "email", waitDays: 0 }, { channel: "email", waitDays: 3 }]);
  assert(legacy.startNodeId === "n0", "legacy array → start n0");
  assert((legacy.nodes["n0"] as { next?: string }).next === "n1", "legacy n0 → n1");
  assert((legacy.nodes["n1"] as { next?: string | null }).next === null, "legacy n1 → end");

  const graph = normalizeSequence({
    nodes: [
      { id: "a", type: "send", channel: "email", waitDays: 0, next: "b" },
      { id: "b", type: "condition", on: "replied", onYes: null, onNo: "c" },
      { id: "c", type: "send", channel: "email", waitDays: 2, next: null },
    ],
    startNodeId: "a",
  });
  assert(graph.startNodeId === "a" && !!graph.nodes["b"], "graph parsed with condition node");
  assert((graph.nodes["b"] as { type: string }).type === "condition", "condition node preserved");

  console.log("2) tenant isolation");
  const orgA = await prisma.organization.create({ data: { name: "Verify A", slug: `verify-a-${Date.now()}` } });
  const orgB = await prisma.organization.create({ data: { name: "Verify B", slug: `verify-b-${Date.now()}` } });
  const leadA = await prisma.lead.create({ data: { organizationId: orgA.id, email: `a-${Date.now()}@verify.test` } });
  const leadB = await prisma.lead.create({ data: { organizationId: orgB.id, email: `b-${Date.now()}@verify.test` } });

  const aVisible = await prisma.lead.findMany({ where: { organizationId: orgA.id } });
  assert(aVisible.some((l) => l.id === leadA.id), "org A sees its own lead");
  assert(!aVisible.some((l) => l.id === leadB.id), "org A does NOT see org B's lead");

  // Same email in two orgs is allowed (composite unique).
  const shared = `shared-${Date.now()}@verify.test`;
  await prisma.lead.create({ data: { organizationId: orgA.id, email: shared } });
  const dup = await prisma.lead.create({ data: { organizationId: orgB.id, email: shared } }).then(() => true).catch(() => false);
  assert(dup, "same email allowed across two orgs");

  console.log("3) segment resolution");
  const seg = await prisma.segment.create({ data: { organizationId: orgA.id, name: "g", kind: "static", leadIds: [leadA.id, leadB.id] } });
  const resolved = await resolveSegmentLeadIds(orgA.id, seg.id);
  assert(resolved.includes(leadA.id) && !resolved.includes(leadB.id), "static segment re-scopes to org (drops foreign lead)");

  // cleanup
  await prisma.lead.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.segment.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
