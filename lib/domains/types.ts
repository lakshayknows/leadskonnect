/**
 * Shared shapes for sending domains.
 *
 * Small on purpose. On the reseller-storefront path the store owns registration
 * and payment, so this module never talks to a registrar API — it only needs to
 * describe the records a domain must have and what a resolver said about them.
 */

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "SRV";

export interface DnsRecord {
  type: DnsRecordType;
  /** Relative to the domain: "@", "_dmarc", "selector1._domainkey". */
  host: string;
  value: string;
  /** MX only. */
  priority?: number;
  ttl?: number;
}
