/**
 * Sending domains.
 *
 * The workspace buys a lookalike domain in our reseller storefront — which
 * takes the payment and credits us the margin — and this module does the part
 * the store cannot: suggest a name worth buying, verify the mail records
 * actually resolve, and hand the mailbox to the existing send path.
 *
 * Nothing here talks to a registrar API. That is a deliberate consequence of
 * the storefront model: the domain lives in the customer's own registrar
 * account, so we can read its DNS from a public resolver but never write it.
 */
export * from "./types";
export {
  requiredRecords,
  dkimRecord,
  verifyDomain,
  nextCheckDelayMs,
  isMeaningfulMismatch,
  DEFAULT_MAIL_PROVIDER,
} from "./dns";
export type { ExpectedRecord, VerifyResult, RecordKind, DomainVerification } from "./dns";
export {
  MAIL_PROVIDERS,
  DEFAULT_PROVIDER_ID,
  providerById,
  defaultProvider,
  detectFromMx,
  connectMethodFor,
} from "./providers";
export type { MailProvider, MailProviderId } from "./providers";
export {
  suggestDomains,
  suggestLocalParts,
  brandFrom,
  isUsableBrand,
  looksLikeDomain,
  isRoleAccount,
  isValidLocalPart,
} from "./suggest";
export { storefrontSearchUrl, storefrontDomainsUrl, storefrontEmailUrl } from "./storefront";
