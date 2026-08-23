/**
 * Candidate names for a sending domain.
 *
 * The point of this file is that most people have never had to think of a
 * second domain name, and an empty search box is where that flow dies. So the
 * screen opens with real candidates derived from what the workspace already
 * uses, ranked by what actually survives a spam filter.
 *
 * What the ranking encodes, in order of weight:
 *  - `.com` first. Cheap bulk TLDs carry the reputation of everything else
 *    registered on them, and a brand-new `.xyz` starts the race behind.
 *  - Prefixes over suffixes. "getacme.com" reads as a company; "acme-outreach"
 *    reads as a marketing appendage, which is exactly what you don't want a
 *    recipient to notice.
 *  - No hyphens, no digits. Both correlate with throwaway domains.
 *  - Shorter wins ties.
 */

/** The brand token out of a domain, an email, or free text. */
export function brandFrom(input: string): string {
  let s = input.trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at !== -1) s = s.slice(at + 1);
  s = s.replace(/^https?:\/\//, "").split("/")[0];
  s = s.split(".")[0];
  return s.replace(/[^a-z0-9]/g, "");
}

/** Consumer mail hosts are never a brand — suggesting "getgmail.com" is absurd. */
const PUBLIC_MAIL_HOSTS = new Set([
  "gmail",
  "googlemail",
  "outlook",
  "hotmail",
  "live",
  "yahoo",
  "ymail",
  "icloud",
  "me",
  "aol",
  "proton",
  "protonmail",
  "zoho",
  "rediffmail",
  "mail",
]);

export function isUsableBrand(brand: string): boolean {
  return brand.length >= 3 && brand.length <= 24 && !PUBLIC_MAIL_HOSTS.has(brand);
}

const PREFIXES = ["get", "try", "go", "hey", "with"];
const SUFFIXES = ["hq", "mail", "team", "app", "group"];
const TLDS = ["com", "co", "io", "net", "in"];

function scoreOf(candidate: string, brand: string): number {
  const [label, tld] = [candidate.slice(0, candidate.indexOf(".")), candidate.slice(candidate.indexOf(".") + 1)];
  let score = 0;

  score += tld === "com" ? 0 : tld === "co" ? 30 : tld === "io" ? 40 : 55;
  // Prefix forms read as a name; suffix forms read as a department.
  score += PREFIXES.some((p) => label === p + brand) ? 5 : 12;
  if (label.includes("-")) score += 40;
  if (/\d/.test(label)) score += 60;
  score += label.length;

  return score;
}

/**
 * Ranked candidates for `seed`. Availability is NOT checked here — that costs a
 * registrar call against a shared 60/min quota, so the caller batches the top N
 * through `checkMany` instead of pricing the whole list.
 */
export function suggestDomains(seed: string, limit = 12): string[] {
  const brand = brandFrom(seed);
  if (!isUsableBrand(brand)) return [];

  const labels = new Set<string>();
  for (const p of PREFIXES) labels.add(p + brand);
  for (const s of SUFFIXES) labels.add(brand + s);
  labels.add(`${brand}-mail`);

  const candidates: string[] = [];
  for (const label of labels) {
    for (const tld of TLDS) candidates.push(`${label}.${tld}`);
  }

  return candidates
    .sort((a, b) => scoreOf(a, brand) - scoreOf(b, brand) || a.localeCompare(b))
    .slice(0, limit);
}

/** Loose sanity check before spending a registrar call on free-text input. */
export function looksLikeDomain(input: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/i.test(input.trim());
}

/** Default local parts for a new domain's first mailboxes. */
export function suggestLocalParts(memberNames: string[], max = 3): string[] {
  const fromPeople = memberNames
    .map((n) => n.trim().toLowerCase().split(/\s+/)[0])
    .map((n) => n.replace(/[^a-z0-9]/g, ""))
    .filter((n) => n.length >= 2);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...fromPeople, "sales", "hello"]) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Role accounts get filtered aggressively on cold mail, and they are also the
 * names people reach for first. Warn at the point of choosing, while it is
 * still free to change.
 */
const ROLE_ACCOUNTS = new Set([
  "info",
  "admin",
  "support",
  "noreply",
  "no-reply",
  "contact",
  "help",
  "office",
  "enquiry",
  "enquiries",
  "billing",
  "webmaster",
  "postmaster",
  "abuse",
]);

export function isRoleAccount(localPart: string): boolean {
  return ROLE_ACCOUNTS.has(localPart.trim().toLowerCase());
}

export function isValidLocalPart(localPart: string): boolean {
  return /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/.test(localPart.trim().toLowerCase());
}
