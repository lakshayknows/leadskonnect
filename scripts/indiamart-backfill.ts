/**
 * IndiaMART Pull API historical backfill (dev PRD §3.6).
 *
 * The live Push webhook only ever sees NEW leads from the moment it's configured — this
 * fills in up to 365 days of history using the separate Pull API key (distinct from the
 * Push webhook's ingest key; generate it on the same seller.indiamart.com → Lead Manager
 * page — it expires after 7 consecutive days unused). Funnels through the exact same
 * ingestMany() path the live webhook uses, reusing indiamartAdapter's field mapping
 * unchanged: the Pull API's `RESPONSE` array uses the identical field names
 * (SENDER_EMAIL, SENDER_MOBILE, ...) as the Push webhook's payload.
 *
 * Usage:
 *   INDIAMART_PULL_API_KEY=xxx npx tsx scripts/indiamart-backfill.ts <organizationId> [days=365]
 *
 * Gotcha (dev PRD §3.6): IndiaMART built the Pull API because in-house systems aren't
 * always reachable 24/7 — if the live webhook had any downtime, re-running this for a
 * recent window is also how you recover the leads that were missed, not just onboarding.
 */
import { prisma } from "../lib/db";
import { indiamartAdapter } from "../lib/channels/inbound";
import { ingestMany } from "../lib/ingest";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** IndiaMART's Pull API expects DD-MMM-YYYYTHH:mm:ss (IST, no timezone offset in the string). */
function formatIndiaMartDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = MONTHS[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}-${mmm}-${d.getFullYear()}T${hh}:${mi}:${ss}`;
}

// IndiaMART's documented per-call window has varied across API versions — walking in
// small chunks is the safe default regardless of the exact current limit. Adjust
// CHUNK_DAYS if their current docs specify something different.
const CHUNK_DAYS = 3;

async function main() {
  const [organizationId, daysArg] = process.argv.slice(2);
  const days = Math.min(Number(daysArg) || 365, 365);
  const key = process.env.INDIAMART_PULL_API_KEY;

  if (!organizationId) throw new Error("Usage: npx tsx scripts/indiamart-backfill.ts <organizationId> [days=365]");
  if (!key) throw new Error("INDIAMART_PULL_API_KEY is not set");

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error(`No organization with id ${organizationId}`);

  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  let cursor = start;
  let totalReceived = 0;
  let totalCreated = 0;

  while (cursor < end) {
    const chunkEnd = new Date(Math.min(cursor.getTime() + CHUNK_DAYS * 86_400_000, end.getTime()));
    const url =
      `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(key)}` +
      `&start_time=${encodeURIComponent(formatIndiaMartDate(cursor))}&end_time=${encodeURIComponent(formatIndiaMartDate(chunkEnd))}`;

    try {
      const res = await fetch(url);
      const json = await res.json().catch(() => null);
      const code = json?.CODE;
      if (code !== 200 && code !== "200") {
        console.warn(`[indiamart-backfill] ${cursor.toISOString().slice(0, 10)}: ${json?.MESSAGE ?? `HTTP ${res.status}`}`);
      } else {
        const events = await indiamartAdapter.receive(json);
        const result = await ingestMany(organizationId, events);
        totalReceived += result.received;
        totalCreated += result.created;
        console.log(
          `[indiamart-backfill] ${cursor.toISOString().slice(0, 10)} → ${chunkEnd.toISOString().slice(0, 10)}: ` +
            `${result.received} leads, ${result.created} new, ${result.merged} merged, ${result.duplicates} duplicate`,
        );
      }
    } catch (e) {
      console.error(`[indiamart-backfill] ${cursor.toISOString().slice(0, 10)} failed:`, e);
    }

    cursor = chunkEnd;
    await new Promise((r) => setTimeout(r, 500)); // be polite to the API between chunks
  }

  console.log(`\nDone. ${totalReceived} leads processed, ${totalCreated} new contacts created.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
