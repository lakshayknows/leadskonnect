/**
 * Inspector for sending domains and their DNS state.
 *
 * Read-only. Answers the question that actually goes wrong on this path: which
 * domains are stuck short of verified, and what is DNS really returning for
 * them right now — as opposed to what we recorded on the last sweep.
 *
 *   npx tsx scripts/verify-domains.ts           # everything
 *   npx tsx scripts/verify-domains.ts --stuck   # only what needs attention
 *   npx tsx scripts/verify-domains.ts --config  # config + a live storefront link
 */
import { prisma } from "../lib/db";
import { configured, env } from "../lib/env";
import { verifyDomain, storefrontSearchUrl, type ExpectedRecord } from "../lib/domains";

const onlyStuck = process.argv.includes("--stuck");
const configOnly = process.argv.includes("--config");

function heading(s: string) {
  console.log(`\n${s}\n${"─".repeat(s.length)}`);
}

function checkConfig() {
  heading("Configuration");
  console.log(`storefront enabled : ${configured.storefront ? "yes" : "NO"}`);
  console.log(`storefront base    : ${env.storefront.baseUrl}`);
  console.log(`private-label id   : ${env.storefront.plid}  (this is what credits the sale)`);
  console.log(`example deep link  : ${storefrontSearchUrl("getacme.com")}`);
}

async function main() {
  checkConfig();
  if (configOnly) return;

  const domains = await prisma.domain.findMany({
    where: onlyStuck ? { status: { not: "active" } } : {},
    orderBy: { createdAt: "desc" },
    include: { records: true, _count: { select: { mailboxes: true } } },
  });

  heading(`Domains (${domains.length})`);
  if (domains.length === 0) console.log("none");

  for (const d of domains) {
    const verified = d.records.filter((r) => r.status === "verified").length;
    const stalled = d.nextCheckAt === null && d.status !== "active";
    console.log(
      `\n${d.name}  [${d.status}]  ${verified}/${d.records.length} DNS  ` +
        `${d._count.mailboxes} mailbox(es)  attempts=${d.checkAttempts}` +
        (stalled ? "  ← GAVE UP, needs a human" : "")
    );
    if (d.failureReason) console.log(`  reason: ${d.failureReason}`);

    for (const r of d.records) {
      if (r.status === "verified") continue;
      console.log(`  ${r.status.padEnd(9)} ${r.kind.padEnd(13)} ${r.host}`);
      console.log(`     expected: ${r.expectedValue}`);
      if (r.observedValue) console.log(`     observed: ${r.observedValue}`);
    }

    // Re-resolve live, so the script reports the world rather than our snapshot.
    if (d.records.length > 0 && d.status !== "active") {
      const expected: ExpectedRecord[] = d.records.map((r) => ({
        kind: r.kind,
        type: r.type as ExpectedRecord["type"],
        host: r.host,
        value: r.expectedValue,
        priority: r.priority ?? undefined,
      }));
      const live = await verifyDomain(d.name, expected).catch(() => null);
      if (live) {
        const now = live.results.filter((r) => r.status === "verified").length;
        console.log(
          `  provider: ${live.detected?.label ?? "not recognised"}` +
            (live.detected ? ` (${live.detected.id})` : "")
        );
        console.log(
          now === verified
            ? `  live DNS agrees: ${now}/${live.results.length}`
            : `  live DNS says ${now}/${live.results.length} — the sweep is behind, run /api/cron/domain-sweep`
        );
      }
    }
  }

  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
