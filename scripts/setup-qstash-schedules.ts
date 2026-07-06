/**
 * Create/refresh QStash Schedules for recurring jobs — reply polling + warm-up — so
 * scheduling works on any Vercel plan (Hobby included). Idempotent: deletes any existing
 * schedules pointing at our endpoints, then recreates them.
 *
 * Run once AFTER the app is deployed to prod:
 *   APP_URL=https://www.followthroo.com npx tsx scripts/setup-qstash-schedules.ts
 * (APP_URL falls back to NEXT_PUBLIC_APP_URL). Requires QSTASH_TOKEN in the environment.
 *
 * Scheduled calls are authenticated by the QStash request signature (see lib/cron-auth.ts),
 * so no CRON_SECRET is required. APP_URL MUST match NEXT_PUBLIC_APP_URL exactly (signature
 * verification checks the destination URL).
 */
const QSTASH_URL = (process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/$/, "");
const TOKEN = process.env.QSTASH_TOKEN;
const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

const SCHEDULES = [
  { path: "/api/inbox/poll", cron: "*/5 * * * *", label: "reply-poller (every 5 min)" },
  { path: "/api/warmup/run", cron: "0 */4 * * *", label: "warm-up (every 4 h)" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function main() {
  if (!TOKEN) throw new Error("QSTASH_TOKEN is not set");
  if (!APP_URL || APP_URL.includes("localhost")) throw new Error(`APP_URL must be your public prod URL, got: "${APP_URL}"`);
  const auth = { Authorization: `Bearer ${TOKEN}` };
  const destUrls = SCHEDULES.map((s) => `${APP_URL}${s.path}`);

  // Remove any existing schedules for our endpoints (idempotent re-run).
  const listRes = await fetch(`${QSTASH_URL}/v2/schedules`, { headers: auth });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any[] = listRes.ok ? await listRes.json().catch(() => []) : [];
  for (const sch of Array.isArray(existing) ? existing : []) {
    const dest = sch.destination || sch.url || "";
    if (destUrls.some((u) => dest === u)) {
      await fetch(`${QSTASH_URL}/v2/schedules/${sch.scheduleId}`, { method: "DELETE", headers: auth });
      console.log(`- deleted old schedule ${sch.scheduleId} → ${dest}`);
    }
  }

  for (const s of SCHEDULES) {
    const dest = `${APP_URL}${s.path}`;
    const res = await fetch(`${QSTASH_URL}/v2/schedules/${dest}`, {
      method: "POST",
      headers: { ...auth, "Upstash-Cron": s.cron, "Content-Type": "application/json" },
      body: "{}",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`FAILED to create ${s.label}: ${res.status} ${JSON.stringify(j)}`);
      process.exit(1);
    }
    console.log(`+ ${s.label}: schedule ${j.scheduleId} → ${dest}`);
  }
  console.log("\nDone. QStash now drives reply polling + warm-up (no Vercel cron needed).");
}

main().catch((e) => { console.error(e); process.exit(1); });
