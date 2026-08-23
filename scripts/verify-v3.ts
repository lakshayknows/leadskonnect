/**
 * Engine-level verification for the V3 spine: tasks, next-action derivation, the
 * auto-follow-up hook, merge safety, and the lead-detail/timeline read paths.
 *
 * Runs against the real database in throwaway organisations, which it deletes on
 * the way out. Faster and more precise than driving these through the UI.
 *
 *   npx tsx scripts/verify-v3.ts
 */
import { prisma } from "../lib/db";
import { resolveContact } from "../lib/identity";
import { createPipeline, addToPipeline } from "../lib/pipeline";
import { recordConversationEvent } from "../lib/conversation";
import {
  createTask, completeTask, listTasks, getTaskBuckets, nextActionsFor, nextActionFor,
} from "../lib/tasks";
import { getLeadDetail, getLeadTimeline, getHome, enrichLeadRows } from "../lib/queries";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ok  ", m); } else { fail++; console.log("  FAIL", m); } };

const DAY = 86_400_000;

async function main() {
  const stamp = Date.now();
  const org = await prisma.organization.create({ data: { name: `v3-verify-${stamp}`, slug: `v3-verify-${stamp}` } });
  const other = await prisma.organization.create({ data: { name: `v3-other-${stamp}`, slug: `v3-other-${stamp}` } });
  const orgId = org.id;

  try {
    /* ---------------------------------------------------------------- */
    console.log("\n— task buckets —");
    const l1 = await resolveContact({
      organizationId: orgId,
      identities: [{ kind: "email", value: `ann-${stamp}@example.invalid` }],
      profile: { firstName: "Ann", company: "Acme" },
      sourceKey: "web_form",
    });

    const overdue = await createTask({ organizationId: orgId, leadId: l1.leadId, title: "Overdue thing", dueAt: new Date(Date.now() - 2 * DAY) });
    await createTask({ organizationId: orgId, leadId: l1.leadId, title: "Today thing", dueAt: new Date() });
    await createTask({ organizationId: orgId, leadId: l1.leadId, title: "Later thing", dueAt: new Date(Date.now() + 5 * DAY) });
    const undated = await createTask({ organizationId: orgId, leadId: l1.leadId, title: "Someday thing", dueAt: null });

    const buckets = await getTaskBuckets(orgId);
    ok(buckets.overdue.some((t) => t.id === overdue.id), "a past-due task lands in Overdue");
    ok(buckets.today.some((t) => t.title === "Today thing"), "a task due today lands in Today");
    ok(buckets.upcoming.some((t) => t.title === "Later thing"), "a future task lands in Upcoming");
    // An undated task belongs somewhere a human will actually look at it.
    ok(buckets.today.some((t) => t.id === undated.id), "an undated open task shows in Today, not nowhere");
    ok(!buckets.overdue.some((t) => t.id === undated.id), "an undated task is never Overdue");

    console.log("\n— completing —");
    ok(await completeTask(orgId, overdue.id), "completeTask returns true for an owned task");
    const afterComplete = await getTaskBuckets(orgId);
    ok(!afterComplete.overdue.some((t) => t.id === overdue.id), "a completed task leaves Overdue");
    ok(afterComplete.done.some((t) => t.id === overdue.id), "…and appears in Done");
    ok(!(await completeTask(other.id, undated.id)), "another org cannot complete this org's task");
    const stillOpen = await prisma.task.findUnique({ where: { id: undated.id }, select: { status: true } });
    ok(stillOpen?.status === "open", "…and the task really is untouched");

    /* ---------------------------------------------------------------- */
    console.log("\n— next action: precedence —");
    // 1. An explicit task wins.
    const na1 = await nextActionFor(orgId, l1.leadId);
    ok(na1?.source === "task", `an open task is the next action (got ${na1?.source})`);

    // 2. With no task, an unanswered inbound message is.
    const l2 = await resolveContact({
      organizationId: orgId,
      identities: [{ kind: "email", value: `bob-${stamp}@example.invalid` }],
      profile: { firstName: "Bob" },
    });
    await prisma.lead.update({ where: { id: l2.leadId }, data: { stage: "contacted" } });
    await prisma.conversationEvent.create({
      data: { organizationId: orgId, leadId: l2.leadId, channel: "email", direction: "outbound", body: "hi", occurredAt: new Date(Date.now() - 2 * 3600_000) },
    });
    const naOut = await nextActionFor(orgId, l2.leadId);
    ok(naOut === null, "an answered contact owes nothing");

    await prisma.conversationEvent.create({
      data: { organizationId: orgId, leadId: l2.leadId, channel: "email", direction: "inbound", body: "interested", occurredAt: new Date() },
    });
    const naIn = await nextActionFor(orgId, l2.leadId);
    ok(naIn?.source === "reply" && naIn.urgent, "an unanswered inbound reply reads as an urgent 'Reply now'");

    // 3. A breached SLA.
    const l3 = await resolveContact({ organizationId: orgId, identities: [{ kind: "email", value: `cara-${stamp}@example.invalid` }] });
    await prisma.lead.update({ where: { id: l3.leadId }, data: { stage: "contacted" } });
    const pipeline = await createPipeline(orgId, "sales", { isDefault: true });
    const item = await addToPipeline({ organizationId: orgId, pipelineId: pipeline.id, leadId: l3.leadId });
    await prisma.pipelineItem.update({ where: { id: item.id }, data: { slaBreachedAt: new Date() } });
    const naSla = await nextActionFor(orgId, l3.leadId);
    ok(naSla?.source === "sla" && naSla.label.startsWith("Overdue in "), `a breached SLA names the stage (got ${naSla?.label})`);

    // 4. Never contacted.
    const l4 = await resolveContact({ organizationId: orgId, identities: [{ kind: "email", value: `dan-${stamp}@example.invalid` }] });
    const naNew = await nextActionFor(orgId, l4.leadId);
    ok(naNew?.source === "uncontacted" && naNew.label === "Contact", "a brand-new lead reads as 'Contact'");

    // 5. Opted out means nothing is owed, whatever else is true.
    await prisma.lead.update({ where: { id: l4.leadId }, data: { optedOut: true } });
    ok((await nextActionFor(orgId, l4.leadId)) === null, "an opted-out lead is never given a next action");

    console.log("\n— next action: batching —");
    const all = [l1.leadId, l2.leadId, l3.leadId, l4.leadId];
    const map = await nextActionsFor(orgId, all);
    ok(map.size === 3, `one batched call resolves every lead at once (3 of 4 owe something, got ${map.size})`);
    ok((await nextActionsFor(orgId, [])).size === 0, "an empty id list short-circuits");

    /* ---------------------------------------------------------------- */
    console.log("\n— auto follow-up on inbound —");
    const l5 = await resolveContact({ organizationId: orgId, identities: [{ kind: "email", value: `eve-${stamp}@example.invalid` }], profile: { firstName: "Eve" } });
    await recordConversationEvent({
      organizationId: orgId, leadId: l5.leadId, channel: "whatsapp", direction: "inbound",
      body: "please send the proposal", externalId: `wa-${stamp}-1`,
    });
    const t5 = await listTasks(orgId, { scope: "open", leadId: l5.leadId });
    ok(t5.length === 1, `an inbound message creates exactly one follow-up (got ${t5.length})`);
    ok(t5[0]?.createdKind === "system", "…marked as system-created, not something the rep typed");
    ok(t5[0]?.kind === "whatsapp", "…on the channel they actually replied on");

    await recordConversationEvent({
      organizationId: orgId, leadId: l5.leadId, channel: "whatsapp", direction: "inbound",
      body: "still waiting", externalId: `wa-${stamp}-2`,
    });
    const t5b = await listTasks(orgId, { scope: "open", leadId: l5.leadId });
    ok(t5b.length === 1, "a chatty contact still owes exactly one thing, not one per message");

    await recordConversationEvent({
      organizationId: orgId, leadId: l5.leadId, channel: "email", direction: "outbound",
      body: "on its way", externalId: `em-${stamp}-1`,
    });
    const t5c = await listTasks(orgId, { scope: "open", leadId: l5.leadId });
    ok(t5c.length === 1, "an outbound message creates no follow-up");

    /* ---------------------------------------------------------------- */
    console.log("\n— merge keeps tasks and notes —");
    const m1 = await resolveContact({ organizationId: orgId, identities: [{ kind: "email", value: `frank-${stamp}@example.invalid` }] });
    const m2 = await resolveContact({ organizationId: orgId, identities: [{ kind: "phone", value: `98765${String(stamp).slice(-5)}` }] });
    ok(m1.leadId !== m2.leadId, "two unlinked records to start with");

    await createTask({ organizationId: orgId, leadId: m2.leadId, title: "Call Frank back" });
    await prisma.note.create({ data: { organizationId: orgId, leadId: m2.leadId, body: "Met at the trade show." } });

    const merged = await resolveContact({
      organizationId: orgId,
      identities: [{ kind: "email", value: `frank-${stamp}@example.invalid` }, { kind: "phone", value: `98765${String(stamp).slice(-5)}` }],
    });
    ok(merged.mergedLeadIds.length === 1, "the linking payload merges them");
    const survivingTasks = await prisma.task.count({ where: { organizationId: orgId, leadId: merged.leadId, title: "Call Frank back" } });
    const survivingNotes = await prisma.note.count({ where: { organizationId: orgId, leadId: merged.leadId } });
    ok(survivingTasks === 1, "the scheduled task survives the merge on the surviving record");
    ok(survivingNotes === 1, "the note survives the merge too");

    /* ---------------------------------------------------------------- */
    console.log("\n— read paths —");
    const detail = await getLeadDetail(orgId, l1.leadId);
    ok(!!detail, "getLeadDetail returns the record");
    ok((detail?.tasks.length ?? 0) > 0, "…with its open tasks");
    ok(detail?.nextAction?.source === "task", "…and a next action");
    ok((await getLeadDetail(other.id, l1.leadId)) === null, "another org cannot read this lead");

    await prisma.note.create({ data: { organizationId: orgId, leadId: l5.leadId, body: "Wants pricing by Friday." } });
    const timeline = await getLeadTimeline(orgId, l5.leadId);
    const kinds = new Set(timeline.map((e) => e.kind));
    ok(timeline.length >= 4, `the timeline merges every source (got ${timeline.length} entries)`);
    ok(kinds.has("message") && kinds.has("note"), "…including both messages and notes");
    const descending = timeline.every((e, i) => i === 0 || new Date(timeline[i - 1].at) >= new Date(e.at));
    ok(descending, "…newest first");

    const rows = await prisma.lead.findMany({ where: { organizationId: orgId }, take: 10 });
    const enriched = await enrichLeadRows(orgId, rows);
    ok(enriched.length === rows.length, "enrichLeadRows preserves the page");
    ok(enriched.some((r) => r.nextAction !== null), "…and attaches next actions");
    ok(enriched.some((r) => r.source !== null), "…and source labels");
    ok((await enrichLeadRows(orgId, [])).length === 0, "…and short-circuits on an empty page");

    const home = await getHome(orgId);
    ok(typeof home.counts.followUpsDue === "number", "getHome returns counts");
    ok(Array.isArray(home.attention), "…an attention list");
    ok(home.pipeline !== null, "…and a pipeline snapshot");

    // l2's last word was theirs and they were never added to a pipeline. Attention
    // must follow the conversation, not the funnel, or exactly the lead most likely
    // to fall through is the one Home hides.
    const inPipeline = await prisma.pipelineItem.count({ where: { organizationId: orgId, leadId: l2.leadId } });
    ok(inPipeline === 0, "the waiting contact is deliberately not in any pipeline");
    ok(
      home.attention.some((a) => a.lead.id === l2.leadId),
      "an unanswered reply surfaces on Home even with no pipeline item",
    );
    // l5 replied, but we answered — the last word is ours, so nothing is owed.
    ok(
      !home.attention.some((a) => a.lead.id === l5.leadId),
      "a contact whose last word was ours is not flagged as waiting",
    );
  } finally {
    // Cascades clear leads, tasks, notes, pipeline rows and conversation events.
    for (const id of [org.id, other.id]) {
      await prisma.task.deleteMany({ where: { organizationId: id } });
      await prisma.note.deleteMany({ where: { organizationId: id } });
      await prisma.conversationEvent.deleteMany({ where: { organizationId: id } });
      await prisma.stageTransition.deleteMany({ where: { item: { organizationId: id } } });
      await prisma.pipelineItem.deleteMany({ where: { organizationId: id } });
      await prisma.pipelineStage.deleteMany({ where: { pipeline: { organizationId: id } } });
      await prisma.pipeline.deleteMany({ where: { organizationId: id } });
      await prisma.contactIdentity.deleteMany({ where: { organizationId: id } });
      await prisma.lead.deleteMany({ where: { organizationId: id } });
      await prisma.leadSource.deleteMany({ where: { organizationId: id } });
      await prisma.organization.delete({ where: { id } }).catch(() => {});
    }
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
