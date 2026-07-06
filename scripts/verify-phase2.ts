/**
 * Phase-2 verification — open/click tracking end-to-end + injector unit checks.
 * Requires the dev server running at SMOKE_BASE (default http://localhost:3940).
 *   SMOKE_BASE=http://localhost:3940 npx tsx scripts/verify-phase2.ts
 */
import { PrismaClient } from "@prisma/client";
import { injectTracking } from "../lib/tracking";

const prisma = new PrismaClient();
const BASE = process.env.SMOKE_BASE || "http://localhost:3940";
let pass = 0, fail = 0;
const assert = (c: boolean, l: string) => (c ? (pass++, console.log(`  ✓ ${l}`)) : (fail++, console.error(`  ✗ ${l}`)));

async function main() {
  console.log("1) injectTracking");
  const html = injectTracking('<a href="https://example.com/x">hi</a><p>text</p>', "MID123", "http://localhost:3940");
  assert(html.includes("/api/track/click/MID123?u="), "outbound link rewritten to click tracker");
  assert(html.includes("/api/track/open/MID123"), "open pixel injected");
  assert(injectTracking('<a href="mailto:a@b.com">x</a>', "M", "http://x").includes("mailto:a@b.com"), "mailto link left untouched");

  console.log("2) open/click routes record activity");
  const org = await prisma.organization.findFirst({ where: { slug: "default-workspace" } });
  const lead = org ? await prisma.lead.findFirst({ where: { organizationId: org.id } }) : null;
  if (!org || !lead) { console.error("  ! no default org / lead to test with"); process.exit(1); }

  const msg = await prisma.message.create({
    data: { organizationId: org.id, leadId: lead.id, channel: "email", status: "sent", idempotencyKey: `smoke-${Date.now()}`, sentAt: new Date() },
  });

  const openRes = await fetch(`${BASE}/api/track/open/${msg.id}`);
  assert(openRes.status === 200 && (openRes.headers.get("content-type") ?? "").includes("image/gif"), "open pixel → 200 image/gif");

  const clickRes = await fetch(`${BASE}/api/track/click/${msg.id}?u=${encodeURIComponent("https://example.com/")}`, { redirect: "manual" });
  assert(clickRes.status === 302 && clickRes.headers.get("location") === "https://example.com/", "click → 302 to original URL");

  // Give the async writes a beat.
  await new Promise((r) => setTimeout(r, 400));
  const opened = await prisma.activityLog.findFirst({ where: { messageId: msg.id, type: "opened" } });
  const clicked = await prisma.activityLog.findFirst({ where: { messageId: msg.id, type: "clicked" } });
  assert(!!opened, "opened ActivityLog recorded (org-scoped)");
  assert(!!clicked, "clicked ActivityLog recorded (org-scoped)");
  assert(opened?.organizationId === org.id, "opened event scoped to the message's org");

  console.log("3) auth gates on new API routes");
  for (const path of ["/api/reports", "/api/deliverability", "/api/warmup/run"]) {
    const r = await fetch(`${BASE}${path}`);
    assert(r.status === 401, `${path} → 401 without session`);
  }

  // cleanup
  await prisma.activityLog.deleteMany({ where: { messageId: msg.id } });
  await prisma.message.delete({ where: { id: msg.id } });

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
