/**
 * DNS record bookkeeping and verification.
 *
 * On the reseller-storefront path there is nothing to register and nothing to
 * charge — the store did both. What remains is the part that actually decides
 * whether outreach lands: are this domain's mail records live yet?
 *
 * The state that matters lives in the DB, never in the queue. `Domain.nextCheckAt`
 * decides what is due and the sweep re-reads it, so a dropped queue message
 * delays a check rather than stranding a domain (docs/ARCHITECTURE.md).
 *
 * Every function here is safe to run twice: verification only reads DNS and
 * writes observations, and the record set is upserted rather than recreated.
 */
import { prisma } from "../db";
import { requiredRecords, verifyDomain, nextCheckDelayMs, type ExpectedRecord } from "./dns";
import { DEFAULT_PROVIDER_ID } from "./providers";
import type { DnsRecordKind, DnsRecordStatus } from "@prisma/client";

/**
 * Record what this domain needs and schedule the first check.
 *
 * `dnsMode` is always "manual" on the storefront path: the domain sits in the
 * customer's own registrar account, so we record what we expect to see and then
 * watch public DNS for it. Nothing is pushed.
 */
export async function applyDnsRecords(
  domainId: string,
  domainName: string,
  _dnsMode: string
): Promise<void> {
  const expected = requiredRecords(domainName, DEFAULT_PROVIDER_ID);

  for (const r of expected) {
    await prisma.domainDnsRecord.upsert({
      where: { domainId_kind_host: { domainId, kind: r.kind as DnsRecordKind, host: r.host } },
      create: {
        domainId,
        kind: r.kind as DnsRecordKind,
        type: r.type,
        host: r.host,
        expectedValue: r.value,
        priority: r.priority ?? null,
      },
      update: { type: r.type, expectedValue: r.value, priority: r.priority ?? null },
    });
  }

  await prisma.domain.update({
    where: { id: domainId },
    data: {
      mailProvider: DEFAULT_PROVIDER_ID,
      nextCheckAt: new Date(Date.now() + (nextCheckDelayMs(0) ?? 20_000)),
      checkAttempts: 0,
    },
  });
}

/** Check every record against public DNS, store what was seen, and reschedule. */
export async function verifyDomainDns(
  domainId: string
): Promise<{ status: string; verified: number; total: number }> {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: { records: true },
  });
  if (!domain) return { status: "missing", verified: 0, total: 0 };
  if (domain.records.length === 0) return { status: "no_records", verified: 0, total: 0 };

  const expected: ExpectedRecord[] = domain.records.map((r) => ({
    kind: r.kind,
    type: r.type as ExpectedRecord["type"],
    host: r.host,
    value: r.expectedValue,
    priority: r.priority ?? undefined,
  }));

  const { results, detected } = await verifyDomain(domain.name, expected);
  const now = new Date();

  // Record who actually runs this domain's mail. Step three reads it to decide
  // whether the mailbox connects by OAuth, by password, or needs server details.
  if (detected && detected.id !== domain.mailProvider) {
    await prisma.domain.update({
      where: { id: domainId },
      data: { mailProvider: detected.id },
    });
  }

  await Promise.all(
    results.map((res) =>
      prisma.domainDnsRecord.updateMany({
        where: { domainId, kind: res.kind as DnsRecordKind, host: res.host },
        data: {
          status: res.status as DnsRecordStatus,
          observedValue: res.observed,
          lastCheckedAt: now,
        },
      })
    )
  );

  const verified = results.filter((r) => r.status === "verified").length;

  if (verified === results.length) {
    await prisma.domain.update({
      where: { id: domainId },
      data: { status: "active", verifiedAt: now, nextCheckAt: null, failureReason: null },
    });
    return { status: "verified", verified, total: results.length };
  }

  const attempts = domain.checkAttempts + 1;
  const delay = nextCheckDelayMs(attempts);
  await prisma.domain.update({
    where: { id: domainId },
    data: {
      checkAttempts: attempts,
      nextCheckAt: delay === null ? null : new Date(Date.now() + delay),
      // Never "failed" — the domain is real and owned, the records just aren't
      // live yet. Failing it here would hide a domain the customer paid for.
      status: "dns_pending",
      failureReason:
        delay === null
          ? "These records still aren't resolving. Check them at your DNS host, then re-verify."
          : null,
    },
  });

  return { status: delay === null ? "gave_up" : "pending", verified, total: results.length };
}

/** Re-check every domain whose next check is due. Idempotent. */
export async function sweepDueDomains(limit = 50): Promise<{ checked: number }> {
  const due = await prisma.domain.findMany({
    where: { nextCheckAt: { lte: new Date() }, status: "dns_pending" },
    select: { id: true },
    take: limit,
    orderBy: { nextCheckAt: "asc" },
  });

  for (const d of due) {
    await verifyDomainDns(d.id).catch((e) =>
      console.error(`[domains] verify failed for ${d.id}:`, e)
    );
  }

  return { checked: due.length };
}
