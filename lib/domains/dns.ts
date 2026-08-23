/**
 * DNS record templates and verification.
 *
 * Verification deliberately queries a PUBLIC resolver over DNS-over-HTTPS
 * rather than asking the registrar what it thinks it wrote. Those are different
 * questions: a registrar knows its own zone the instant it changes, but a
 * receiving mail server only ever sees what has propagated. Checking the
 * registrar would let us tell someone "verified" minutes before it is true, and
 * the first thing they'd do with that is send a campaign.
 *
 * It also identifies the provider from the MX records the domain actually has,
 * instead of insisting on one set of values — see providers.ts for why.
 *
 * DoH over plain fetch keeps this dependency-free and works unchanged on Fluid
 * Compute, where raw UDP resolvers are awkward.
 */
import {
  detectFromMx,
  defaultProvider,
  providerById,
  type MailProvider,
  type MailProviderId,
} from "./providers";
import type { DnsRecord } from "./types";

export type RecordKind = "MX" | "SPF" | "DKIM" | "DMARC";

export interface ExpectedRecord extends DnsRecord {
  kind: RecordKind;
}

export interface VerifyResult {
  kind: RecordKind;
  host: string;
  expected: string;
  observed: string | null;
  status: "verified" | "mismatch" | "missing";
}

export interface DomainVerification {
  results: VerifyResult[];
  /** Whoever actually runs this domain's mail, if we recognised them. */
  detected: MailProvider | null;
}

export const DEFAULT_MAIL_PROVIDER: MailProviderId = "titan";

/**
 * The records a domain needs before it can send.
 *
 * DKIM is absent on purpose: its selector and public key are issued when the
 * mailbox is created, so there is nothing truthful to show until then. It gets
 * appended later via `dkimRecord()`.
 */
export function requiredRecords(domain: string, providerId?: string | null): ExpectedRecord[] {
  const provider = providerById(providerId) ?? defaultProvider();
  return [
    // One MX row, not one per host. Matching is "does this domain's MX point at
    // a provider we recognise", so two rows would always report the same status
    // and just make the table look like there is more to do than there is. The
    // value lists every host with its priority, which is what a manual setup
    // needs anyway.
    {
      kind: "MX",
      type: "MX",
      host: "@",
      value: provider.mx.map((mx) => `${mx.host} (${mx.priority})`).join(", "),
      priority: provider.mx[0]?.priority,
      ttl: 3600,
    },
    {
      kind: "SPF",
      type: "TXT",
      host: "@",
      value: `v=spf1 include:${provider.spfInclude} ~all`,
      ttl: 3600,
    },
    {
      kind: "DMARC",
      type: "TXT",
      host: "_dmarc",
      // p=none to start. Monitoring first is the correct order: quarantining on
      // a domain whose DKIM has never been observed passing drops real mail.
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      ttl: 3600,
    },
  ];
}

/** The DKIM record, once the provider has issued a selector. */
export function dkimRecord(selector: string, target: string): ExpectedRecord {
  return { kind: "DKIM", type: "CNAME", host: `${selector}._domainkey`, value: target, ttl: 3600 };
}

// ---- resolution -----------------------------------------------------------

const RESOLVERS = [
  (name: string, type: string) =>
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  (name: string, type: string) =>
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
];

interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

/**
 * Query one name/type. Tries a second resolver before reporting nothing — a
 * single resolver hiccup must not read as "the customer's DNS is wrong".
 * Returns null when every resolver failed (unknown), [] for a real NXDOMAIN.
 */
async function resolve(name: string, type: string): Promise<string[] | null> {
  for (const build of RESOLVERS) {
    try {
      const res = await fetch(build(name, type), {
        headers: { Accept: "application/dns-json" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { Status: number; Answer?: DohAnswer[] };
      if (body.Status === 3) return []; // NXDOMAIN is an answer, not a failure
      if (body.Status !== 0) continue;
      return (body.Answer ?? []).map((a) => a.data);
    } catch {
      // try the next resolver
    }
  }
  return null;
}

const stripDot = (s: string) => s.replace(/\.$/, "").toLowerCase().trim();
/** TXT answers arrive quoted, and long ones arrive as several quoted chunks. */
const unquoteTxt = (s: string) => s.replace(/"\s*"/g, "").replace(/^"|"$/g, "").trim();
const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function fqdn(host: string, domain: string): string {
  return host === "@" ? domain : `${host}.${domain}`;
}

/**
 * Check a domain's mail records.
 *
 * MX is resolved first because everything else depends on who the provider
 * turns out to be: SPF is then checked against *their* include rather than the
 * one we happened to suggest.
 */
export async function verifyDomain(
  domain: string,
  expected: ExpectedRecord[]
): Promise<DomainVerification> {
  const mxAnswers = await resolve(domain, "MX");
  const detected = mxAnswers ? detectFromMx(mxAnswers) : null;

  const results = await Promise.all(
    expected.map((r) => checkOne(domain, r, detected, mxAnswers))
  );

  return { results, detected };
}

async function checkOne(
  domain: string,
  r: ExpectedRecord,
  detected: MailProvider | null,
  mxAnswers: string[] | null
): Promise<VerifyResult> {
  const base = { kind: r.kind, host: r.host, expected: r.value };

  const answers =
    r.kind === "MX" ? mxAnswers : await resolve(fqdn(r.host, domain), r.type);

  // Resolver failure, not a customer problem. Report it as still pending
  // rather than accusing them of a mistake they did not make.
  if (answers === null) return { ...base, observed: null, status: "missing" };
  if (answers.length === 0) return { ...base, observed: null, status: "missing" };

  const hit = match(r, answers, detected);
  return {
    ...base,
    observed: hit ?? answers.map(unquoteTxt).join(", ").slice(0, 500),
    status: hit ? "verified" : "mismatch",
  };
}

function match(
  expected: ExpectedRecord,
  answers: string[],
  detected: MailProvider | null
): string | null {
  switch (expected.kind) {
    case "MX": {
      // Any recognised provider counts. A customer already on Google Workspace
      // has working mail, and calling that a misconfiguration would be a bug.
      return detected ? answers.join(", ") : null;
    }
    case "SPF": {
      const spf = answers.map(unquoteTxt).find((t) => t.toLowerCase().startsWith("v=spf1"));
      if (!spf) return null;
      // Compare on the include, not the whole string — a customer may
      // legitimately have merged it into an existing SPF record. Check the
      // detected provider's include, falling back to what we suggested.
      const want = (
        detected?.spfInclude ?? expected.value.match(/include:(\S+)/)?.[1] ?? ""
      ).toLowerCase();
      if (!want) return null;
      return spf.toLowerCase().includes(`include:${want}`) ? spf : null;
    }
    case "DMARC": {
      // Any valid policy counts — ours is a starting point, and a stricter one
      // the customer already set is better, not worse.
      return answers.map(unquoteTxt).find((t) => t.toLowerCase().startsWith("v=dmarc1")) ?? null;
    }
    case "DKIM": {
      const want = stripDot(expected.value);
      return answers.map(stripDot).find((a) => a === want) ?? null;
    }
  }
}

/**
 * Backoff for the verification sweep. DNS usually settles in minutes, but
 * someone may not add the records for a day — so widen quickly, then keep a
 * slow heartbeat rather than either hammering or giving up early.
 */
export function nextCheckDelayMs(attempt: number): number | null {
  const schedule = [20_000, 60_000, 120_000, 300_000, 900_000, 3_600_000];
  if (attempt < schedule.length) return schedule[attempt];
  if (attempt < schedule.length + 48) return 3_600_000; // ~48h of hourly checks
  return null; // stop; the domain needs a human
}

/** True when the squashed forms differ — used for surfacing a real typo. */
export function isMeaningfulMismatch(expected: string, observed: string | null): boolean {
  return !!observed && squash(expected) !== squash(observed);
}
