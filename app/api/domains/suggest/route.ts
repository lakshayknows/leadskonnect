import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { suggestDomains, brandFrom, isUsableBrand, looksLikeDomain } from "@/lib/domains";
import { storefrontSearchUrl } from "@/lib/domains/storefront";

export const runtime = "nodejs";

/**
 * GET /api/domains/suggest?q=acme
 *
 * Names worth buying, each with a link into our storefront.
 *
 * Deliberately does NOT check availability. That would need the registrar's
 * Availability API, which is gated behind holding 50+ domains and costs a call
 * against a quota shared by every tenant — and the storefront checks
 * availability anyway, live, on the page we're sending people to. Guessing here
 * would only add a way to be wrong.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const seed = q || (await seedForOrg(ctx.orgId));

  const exact = looksLikeDomain(q) ? q : null;
  const brand = seed ? brandFrom(seed) : "";
  const generated = isUsableBrand(brand) ? suggestDomains(brand, 9) : [];

  const owned = new Set(
    (
      await prisma.domain.findMany({
        where: { organizationId: ctx.orgId },
        select: { name: true },
      })
    ).map((d) => d.name)
  );

  const names = [...new Set([...(exact ? [exact] : []), ...generated])].filter((n) => !owned.has(n));

  return ok({
    seed: brand || null,
    suggestions: names.map((domain) => ({ domain, storeUrl: storefrontSearchUrl(domain) })),
  });
}

/** Suggest from the domain the workspace already sends from, else its own name. */
async function seedForOrg(orgId: string): Promise<string | null> {
  const account = await prisma.sendingAccount.findFirst({
    where: { organizationId: orgId, active: true },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  if (account?.email) {
    const brand = brandFrom(account.email);
    if (isUsableBrand(brand)) return brand;
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, slug: true },
  });
  return org?.slug || org?.name || null;
}
