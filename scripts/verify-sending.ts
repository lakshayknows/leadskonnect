/**
 * Verification for the sending-account rules.
 *
 * Two things are being protected here:
 *   1. There is no platform fallback mailbox. A send with no connected account fails
 *      loudly rather than quietly going out under Followthroo's own From address (which
 *      also stranded every reply in a mailbox the poller never reads).
 *   2. A sending account belongs to exactly one org. The account id is a bare uuid, so
 *      without the owning org in the lookup one tenant could send through another's
 *      connected mailbox.
 *
 *   npx tsx scripts/verify-sending.ts
 */
import { prisma } from "../lib/db";
import { emailChannel, defaultSendingAccountId } from "../lib/channels/email";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ok  ", m); } else { fail++; console.log("  FAIL", m); } };

const LEAD = { id: "verify-lead", email: "someone@example.invalid", phone: null, linkedinUrl: null, firstName: "Someone" };
const MSG = { subject: "hello", body: "hello there" };

async function main() {
  const stamp = Date.now();
  const orgA = await prisma.organization.create({ data: { name: `send-a-${stamp}`, slug: `send-a-${stamp}` } });
  const orgB = await prisma.organization.create({ data: { name: `send-b-${stamp}`, slug: `send-b-${stamp}` } });

  try {
    console.log("\n— no platform fallback —");
    let r = await emailChannel.send(LEAD, MSG, undefined, orgA.id);
    ok(r.skipped === true && /No sending account connected/.test(r.reason ?? ""),
       `a send with no account is refused (${r.reason})`);

    r = await emailChannel.send(LEAD, MSG, "default", orgA.id);
    ok(r.skipped === true && /No sending account connected/.test(r.reason ?? ""),
       'the old "default" sentinel is refused too, not treated as a mailbox');

    ok((await defaultSendingAccountId(orgA.id)) === null, "an org with no accounts resolves to null, never to env SMTP");

    console.log("\n— tenant isolation —");
    // Deliberately unreachable host: a send that gets *past* the guards should fail on
    // connection, which is how we tell "allowed through" from "blocked".
    const accB = await prisma.sendingAccount.create({
      data: {
        organizationId: orgB.id, name: "Org B Desk", email: `b-${stamp}@example.invalid`,
        provider: "smtp", host: "127.0.0.1", port: 1, secure: false, user: "u", pass: "p",
      },
    });

    r = await emailChannel.send(LEAD, MSG, accB.id, orgA.id);
    ok(r.skipped === true && /not found/.test(r.reason ?? ""),
       "org A cannot send through org B's mailbox");

    r = await emailChannel.send(LEAD, MSG, accB.id, "global");
    ok(r.skipped === true && /organization scope/.test(r.reason ?? ""),
       "a send with no org scope is refused rather than defaulting to trust");

    console.log("\n— the owning org can send —");
    r = await emailChannel.send(LEAD, MSG, accB.id, orgB.id);
    const blockedByGuard = r.skipped === true && /not found|No sending account|organization scope/.test(r.reason ?? "");
    ok(!blockedByGuard, `org B reaches its own mailbox (failed at transport, as expected: ${r.error?.slice(0, 60) ?? r.reason})`);

    console.log("\n— inactive accounts —");
    await prisma.sendingAccount.update({ where: { id: accB.id }, data: { active: false } });
    r = await emailChannel.send(LEAD, MSG, accB.id, orgB.id);
    ok(r.skipped === true && /inactive/.test(r.reason ?? ""), "an inactive mailbox is refused");
    ok((await defaultSendingAccountId(orgB.id)) === null, "…and is not offered as the org's default");

    await prisma.sendingAccount.update({ where: { id: accB.id }, data: { active: true } });
    ok((await defaultSendingAccountId(orgB.id)) === accB.id, "a reactivated mailbox becomes the default again");
  } finally {
    for (const id of [orgA.id, orgB.id]) {
      await prisma.sendingAccount.deleteMany({ where: { organizationId: id } });
      await prisma.organization.delete({ where: { id } }).catch(() => {});
    }
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
