/**
 * Engine-level verification for the CRM core: identity resolution and merge,
 * the pipeline state machine, SLA sweeping, and inbound adapter mapping.
 *
 * Runs against the real database in a throwaway organisation, which it deletes
 * on the way out. Faster and more precise than driving these through the UI.
 *
 *   npx tsx scripts/verify-crm.ts
 */
import { prisma } from "../lib/db";
import { resolveContact, normalizePhone, normalizeLinkedIn } from "../lib/identity";
import { createPipeline, addToPipeline, moveToStage, getBoard, getAgeing, sweepSlaBreaches, BackwardMoveNeedsReason } from "../lib/pipeline";
import { ingestEvent } from "../lib/ingest";
import { indiamartAdapter, webFormAdapter, mapPayload } from "../lib/channels/inbound";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ok  ", m); } else { fail++; console.log("  FAIL", m); } };

async function main() {
  const org = await prisma.organization.create({
    data: { name: `crm-verify-${Date.now()}`, slug: `crm-verify-${Date.now()}` },
  });
  const orgId = org.id;
  console.log("\n— normalisation —");
  ok(normalizePhone("09876543210") === "+919876543210", "leading zero -> E.164");
  ok(normalizePhone("+91 98765 43210") === "+919876543210", "spaced +91 -> same value");
  ok(normalizePhone("9876543210") === "+919876543210", "bare 10-digit -> same value");
  ok(normalizeLinkedIn("https://WWW.LinkedIn.com/in/Jane-Doe/?utm=x") === "linkedin.com/in/jane-doe", "linkedin canonicalised");

  console.log("\n— identity graph —");
  const a = await resolveContact({ organizationId: orgId, identities: [{ kind: "email", value: "Jane@Example.com" }], profile: { firstName: "Jane" }, sourceKey: "web_form" });
  ok(a.created, "first sighting creates a contact");
  const b = await resolveContact({ organizationId: orgId, identities: [{ kind: "email", value: "jane@example.com" }] });
  ok(!b.created && b.leadId === a.leadId, "different casing resolves to the same contact");

  // A second contact known only by phone.
  const c = await resolveContact({ organizationId: orgId, identities: [{ kind: "phone", value: "9876543210" }], profile: { company: "Acme" } });
  ok(c.created && c.leadId !== a.leadId, "phone-only contact is separate while unlinked");

  // Now a payload carrying BOTH -> they are the same person; must merge.
  const m = await resolveContact({ organizationId: orgId, identities: [{ kind: "email", value: "jane@example.com" }, { kind: "phone", value: "+91 98765 43210" }] });
  ok(m.mergedLeadIds.length === 1, "linking payload merges the two records");
  ok(m.leadId === a.leadId, "oldest record survives the merge");
  const survivors = await prisma.lead.count({ where: { organizationId: orgId } });
  ok(survivors === 1, `exactly one contact remains (got ${survivors})`);
  const merged = await prisma.lead.findUnique({ where: { id: m.leadId } });
  ok(merged?.company === "Acme", "merged record keeps the loser's company");

  console.log("\n— pipeline engine —");
  const pipe = await createPipeline(orgId, "sales", { isDefault: true });
  ok(pipe.stages.length === 7, `sales template seeds 7 stages (got ${pipe.stages.length})`);
  ok(pipe.stages[0].slaHours === 4, "first stage carries its SLA");

  const item = await addToPipeline({ organizationId: orgId, pipelineId: pipe.id, leadId: m.leadId });
  ok(!!item.slaDueAt, "SLA due date computed on entry");
  const again = await addToPipeline({ organizationId: orgId, pipelineId: pipe.id, leadId: m.leadId });
  ok(again.id === item.id, "adding twice is idempotent");

  const moved = await moveToStage({ organizationId: orgId, itemId: item.id, toStageId: pipe.stages[1].id });
  ok(moved.stageId === pipe.stages[1].id, "forward move succeeds without a reason");

  let threw = false;
  try { await moveToStage({ organizationId: orgId, itemId: item.id, toStageId: pipe.stages[0].id }); }
  catch (e) { threw = e instanceof BackwardMoveNeedsReason; }
  ok(threw, "backward move without a reason is rejected");

  const back = await moveToStage({ organizationId: orgId, itemId: item.id, toStageId: pipe.stages[0].id, reason: "budget fell through" });
  ok(back.stageId === pipe.stages[0].id, "backward move succeeds with a reason");
  const t = await prisma.stageTransition.findFirst({ where: { itemId: item.id, direction: "backward" } });
  ok(t?.reason === "budget fell through", "reason is recorded on the transition");

  const won = pipe.stages.find((s) => s.kind === "won")!;
  const closed = await moveToStage({ organizationId: orgId, itemId: item.id, toStageId: won.id });
  ok(closed.closedAt !== null && closed.slaDueAt === null, "terminal stage closes the item and stops the SLA clock");

  console.log("\n— SLA + ageing —");
  const lead2 = await resolveContact({ organizationId: orgId, identities: [{ kind: "email", value: "overdue@example.com" }] });
  const it2 = await addToPipeline({ organizationId: orgId, pipelineId: pipe.id, leadId: lead2.leadId });
  await prisma.pipelineItem.update({ where: { id: it2.id }, data: { slaDueAt: new Date(Date.now() - 5 * 3600_000) } });
  const swept = await sweepSlaBreaches(orgId);
  ok(swept.breached === 1, `sweep marks the overdue item (got ${swept.breached})`);
  const swept2 = await sweepSlaBreaches(orgId);
  ok(swept2.breached === 0, "sweep is idempotent — no double escalation");
  const ageing = await getAgeing(orgId);
  ok(ageing.length === 1 && ageing[0].overdueHours >= 4, "ageing lists it with hours overdue");

  console.log("\n— inbound adapters —");
  const im = await indiamartAdapter.receive({ RESPONSE: [{ SENDER_NAME: "Ravi Kumar", SENDER_MOBILE: "09123456789", SENDER_COMPANY: "Kumar Traders", QUERY_MESSAGE: "Need pricing" }] });
  ok(im.length === 1 && im[0].sourceKey === "indiamart", "IndiaMART envelope parsed");
  ok(im[0].profile?.firstName === "Ravi" && im[0].profile?.lastName === "Kumar", "full name split correctly");
  const wf = await webFormAdapter.receive({ name: "Sara Lee", "Email Address": "sara@example.com", Message: "hi" });
  ok(wf.length === 1 && wf[0].identities[0].value === "sara@example.com", "web form maps varied key casing");
  ok(mapPayload({ note: "no identifiers" }, "web_form") === null, "payload with no identifiers is dropped, not stored");

  console.log("\n— ingestion end to end —");
  const r1 = await ingestEvent(orgId, im[0]);
  ok(r1.created && !!r1.leadId, "inbound event creates a contact");
  const onBoard = await getBoard(orgId, pipe.id);
  const inPipeline = onBoard!.stages.flatMap((s) => s.items).some((i) => i.leadId === r1.leadId);
  ok(inPipeline, "ingested contact lands on the board");
  const conv = await prisma.conversationEvent.count({ where: { organizationId: orgId, leadId: r1.leadId! } });
  ok(conv === 1, "conversation timeline records the inbound event");

  const dupEvent = { ...im[0], externalId: "ext-1" };
  await ingestEvent(orgId, dupEvent);
  const r3 = await ingestEvent(orgId, dupEvent);
  ok(r3.duplicate, "replayed webhook with the same externalId is deduped");

  const src = await prisma.leadSource.findFirst({ where: { organizationId: orgId, key: "indiamart" } });
  ok(!!src, "lead source auto-created on first sighting");

  // cleanup
  await prisma.$transaction([
    prisma.escalationEvent.deleteMany({ where: { organizationId: orgId } }),
    prisma.stageTransition.deleteMany({ where: { item: { organizationId: orgId } } }),
    prisma.pipelineItem.deleteMany({ where: { organizationId: orgId } }),
    prisma.pipelineStage.deleteMany({ where: { pipeline: { organizationId: orgId } } }),
    prisma.pipeline.deleteMany({ where: { organizationId: orgId } }),
    prisma.conversationEvent.deleteMany({ where: { organizationId: orgId } }),
    prisma.contactIdentity.deleteMany({ where: { organizationId: orgId } }),
    prisma.lead.deleteMany({ where: { organizationId: orgId } }),
    prisma.leadSource.deleteMany({ where: { organizationId: orgId } }),
    prisma.organization.delete({ where: { id: orgId } }),
  ]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
