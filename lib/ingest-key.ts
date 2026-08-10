import crypto from "node:crypto";

/**
 * Per-org key authenticating third-party webhook posts to /api/inbound/*.
 *
 * Derived from the app secret rather than stored, so it needs no table, is
 * stable across deploys, and every org's key is revoked at once by rotating the
 * secret. Lives outside the route because Next.js route modules may only export
 * request handlers and their config.
 */
export function ingestKeyFor(orgId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.APP_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(`ingest:${orgId}`).digest("hex").slice(0, 32);
}
