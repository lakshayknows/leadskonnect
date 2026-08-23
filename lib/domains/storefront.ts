/**
 * Reseller storefront hand-off.
 *
 * On a Turnkey reseller plan the storefront takes the customer's payment and
 * credits us the margin, so the product must NOT run its own checkout for
 * domains — that would charge twice. Instead we do the part the storefront
 * can't: suggest a name worth buying, then verify and connect what they bought.
 *
 * The `plid` is what attributes the sale. Lose it from the URL and the customer
 * still gets their domain and we get nothing, which is a silent failure — so it
 * is built in one place rather than string-concatenated at call sites.
 */
import { env } from "../env";

/** Search results for one candidate, branded as our own store. */
export function storefrontSearchUrl(domain: string): string {
  const u = new URL("/products/domain-registration/find", env.storefront.baseUrl);
  u.searchParams.set("plid", env.storefront.plid);
  u.searchParams.set("domainToCheck", domain);
  return u.toString();
}

/** The store's domain landing page, for browsing without a candidate in mind. */
export function storefrontDomainsUrl(): string {
  const u = new URL("/products/domain-registration", env.storefront.baseUrl);
  u.searchParams.set("plid", env.storefront.plid);
  return u.toString();
}

/**
 * Professional Email on the store. Buying the mailbox from the same place as
 * the domain is what makes DNS a non-event: the records are provisioned inside
 * one account instead of being copied between two.
 */
export function storefrontEmailUrl(): string {
  const u = new URL("/products/email-office", env.storefront.baseUrl);
  u.searchParams.set("plid", env.storefront.plid);
  return u.toString();
}
