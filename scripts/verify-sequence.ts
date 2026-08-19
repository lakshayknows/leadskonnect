/**
 * Campaign sequence diagnostic — why did a lead stop getting mail?
 *
 * Read-only by default. Prints every active enrollment with the node it is parked on,
 * how overdue its next hop is, and how many messages actually went out — which is how you
 * tell "the queue message was dropped" apart from "the sequence genuinely finished".
 *
 *   npx tsx scripts/verify-sequence.ts              # report only
 *   npx tsx scripts/verify-sequence.ts --sweep      # then recover anything overdue
 *
 * The sweep is the same call the /api/cron/enrollment-sweep schedule makes, and is safe to
 * run repeatedly: each enrollment is claimed atomically before its node executes.
 */
import { prisma } from "../lib/db";
import { normalizeSequence, sweepDueEnrollments } from "../lib/campaign-engine";

const DO_SWEEP = process.argv.includes("--sweep");
const MIN = 60_000;

function ago(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const abs = Math.abs(ms);
  const unit =
    abs < MIN ? `${Math.round(abs / 1000)}s` :
    abs < 60 * MIN ? `${Math.round(abs / MIN)}m` :
    abs < 48 * 60 * MIN ? `${(abs / (60 * MIN)).toFixed(1)}h` :
    `${(abs / (24 * 60 * MIN)).toFixed(1)}d`;
  return ms >= 0 ? `${unit} overdue` : `in ${unit}`;
}

async function main() {
  const enrollments = await prisma.enrollment.findMany({
    where: { status: { in: ["active", "paused"] } },
    orderBy: [{ campaignId: "asc" }, { nextRunAt: "asc" }],
    include: {
      campaign: { select: { id: true, name: true, status: true, sequence: true, sendingAccountId: true } },
      lead: { select: { id: true, email: true, firstName: true } },
    },
  });

  if (enrollments.length === 0) {
    console.log("\nNo active or paused enrollments.\n");
    return;
  }

  const byCampaign = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const list = byCampaign.get(e.campaignId) ?? [];
    list.push(e);
    byCampaign.set(e.campaignId, list);
  }

  let stalled = 0;

  for (const [campaignId, list] of byCampaign) {
    const c = list[0].campaign;
    const graph = normalizeSequence(c.sequence);
    const order = Object.values(graph.nodes);

    console.log(`\n=== ${c.name}  (${c.status})  ${campaignId} ===`);
    console.log(
      `  sequence: ${order.length} node(s), start=${graph.startNodeId ?? "—"}, ` +
      `mailbox=${c.sendingAccountId ?? "NONE (sends will fail)"}`
    );
    for (const n of order) {
      const wait = "waitDays" in n ? `waitDays=${n.waitDays}` : "";
      const next = "next" in n ? ` → ${n.next ?? "end"}` : "";
      console.log(`    ${n.id}  ${n.type}  ${wait}${next}`);
    }

    for (const e of list) {
      // "Went out" is anything past the outbox — a delivered/replied mail is still a send.
      const sent = await prisma.message.count({
        where: { leadId: e.leadId, campaignId, status: { notIn: ["queued", "failed", "draft"] } },
      });
      const overdue =
        e.status === "active" && e.nextRunAt !== null && e.nextRunAt < new Date(Date.now() - 10 * MIN);
      // Only an active campaign is sweepable; the rest are parked by design, not stuck.
      const sweepable = overdue && c.status === "active";
      if (sweepable) stalled++;
      const node = e.currentNodeId ? graph.nodes[e.currentNodeId] : undefined;
      console.log(
        `  ${sweepable ? "STALLED" : overdue ? "parked " : "  ok   "}  ` +
        `${(e.lead.email ?? e.lead.firstName ?? e.leadId).padEnd(32)}` +
        ` status=${e.status.padEnd(9)} at=${(e.currentNodeId ?? "—").padEnd(6)}` +
        `${node ? "" : "(node missing from sequence!) "}` +
        ` next=${ago(e.nextRunAt).padEnd(14)} sent=${sent}`
      );
    }
  }

  console.log(
    `\n${enrollments.length} enrollment(s); ${stalled} stalled and sweepable ` +
    `(overdue >10m, nothing queued, campaign still active).
` +
    `"parked" = overdue but its campaign is draft/paused/done, so the sweep leaves it alone.`
  );

  if (stalled > 0 && !DO_SWEEP) {
    console.log("Re-run with --sweep to advance them now.\n");
  } else if (DO_SWEEP) {
    console.log("\nSweeping…");
    const r = await sweepDueEnrollments();
    console.log(`  due=${r.due} recovered=${r.recovered} failed=${r.failed}\n`);
  } else {
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
