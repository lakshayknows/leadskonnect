/**
 * Mail providers, identified from a domain's real MX records.
 *
 * The naive version of this file is a single hardcoded record set: "here is what
 * your DNS must say". That breaks the moment a customer already runs Google
 * Workspace, because we'd tell them their working mail setup is misconfigured.
 *
 * So it works the other way round. We resolve the MX records the domain actually
 * has, match them to a known provider, and check SPF against *that* provider.
 * Two things fall out of it for free:
 *
 *  - Verification is right whatever the customer bought.
 *  - We learn the SMTP host, which is what lets the mailbox connect with an
 *    address and a password instead of a five-field server form.
 */

export type MailProviderId = "titan" | "google" | "microsoft" | "secureserver" | "unknown";

export interface MailProvider {
  id: MailProviderId;
  /** Shown to the customer. Never says "Titan" — they bought "Professional Email". */
  label: string;
  /** Matches the host half of an MX answer. */
  mxMatch: RegExp;
  /** What we tell a customer to add when they have no mail set up yet. */
  mx: { host: string; priority: number }[];
  /** The token that must appear in their SPF record. */
  spfInclude: string;
  smtp: { host: string; port: number; secure: boolean } | null;
  imap: { host: string; port: number } | null;
  /**
   * Set when the mailbox can be connected by OAuth instead of a password —
   * currently only Google, which the app already supports end to end.
   */
  oauth: "google" | null;
}

/**
 * Ordered: the first match wins. Titan is first because it is what the store
 * sells as "Professional Email", so it is the common case.
 */
export const MAIL_PROVIDERS: MailProvider[] = [
  {
    id: "titan",
    label: "Professional Email",
    mxMatch: /(^|\.)titan\.email$/i,
    mx: [
      { host: "mx1.titan.email", priority: 10 },
      { host: "mx2.titan.email", priority: 20 },
    ],
    spfInclude: "spf.titan.email",
    smtp: { host: "smtp.titan.email", port: 587, secure: false },
    imap: { host: "imap.titan.email", port: 993 },
    oauth: null,
  },
  {
    id: "google",
    label: "Google Workspace",
    mxMatch: /(^|\.)(google\.com|googlemail\.com)$/i,
    mx: [
      { host: "smtp.google.com", priority: 1 },
    ],
    spfInclude: "_spf.google.com",
    // Gmail rejects an app password over SMTP for Workspace accounts with
    // modern security defaults, so OAuth is the only path worth offering.
    smtp: null,
    imap: null,
    oauth: "google",
  },
  {
    id: "microsoft",
    label: "Microsoft 365",
    mxMatch: /\.mail\.protection\.outlook\.com$/i,
    mx: [],
    spfInclude: "spf.protection.outlook.com",
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
    imap: { host: "outlook.office365.com", port: 993 },
    oauth: null,
  },
  {
    id: "secureserver",
    label: "Professional Email (classic)",
    mxMatch: /(^|\.)secureserver\.net$/i,
    mx: [
      { host: "smtp.secureserver.net", priority: 0 },
      { host: "mailstore1.secureserver.net", priority: 10 },
    ],
    spfInclude: "secureserver.net",
    smtp: { host: "smtpout.secureserver.net", port: 587, secure: false },
    imap: { host: "imap.secureserver.net", port: 993 },
    oauth: null,
  },
];

/** What a domain with no mail yet is told to set up. */
export const DEFAULT_PROVIDER_ID: MailProviderId = "titan";

export function providerById(id: string | null | undefined): MailProvider | null {
  return MAIL_PROVIDERS.find((p) => p.id === id) ?? null;
}

export function defaultProvider(): MailProvider {
  return providerById(DEFAULT_PROVIDER_ID)!;
}

/**
 * Identify the provider from MX answers.
 *
 * `answers` are raw DoH strings like "10 mx1.titan.email." — priority and the
 * trailing dot are stripped before matching.
 */
export function detectFromMx(answers: string[]): MailProvider | null {
  const hosts = answers.map((a) => a.trim().split(/\s+/).pop()?.replace(/\.$/, "") ?? "");
  for (const provider of MAIL_PROVIDERS) {
    if (hosts.some((h) => provider.mxMatch.test(h))) return provider;
  }
  return null;
}

/**
 * How the mailbox should be connected once the provider is known.
 *
 * "oauth"    — one click, no password (Google).
 * "password" — we know the servers, so only an address and password are needed.
 * "manual"   — provider unrecognised; fall back to asking for server details.
 */
export function connectMethodFor(provider: MailProvider | null): "oauth" | "password" | "manual" {
  if (!provider) return "manual";
  if (provider.oauth) return "oauth";
  if (provider.smtp) return "password";
  return "manual";
}
